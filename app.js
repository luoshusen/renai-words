// ========== 换成你自己的 Supabase 信息 ==========
const SUPABASE_URL = 'https://gzzkiynxaggepyqrjtdp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_I1y3k3O2cnH74CTVKIR-Dg_g-U047Nz';
// ===============================================

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentProfile = null;

// ========== 视图切换 ==========
function showView(viewId) {
  document.querySelectorAll('section').forEach(s => s.style.display = 'none');
  document.getElementById(viewId).style.display = 'block';
}

// ========== 初始化 ==========
async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    currentUser = user;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    currentProfile = profile;
    if (profile.role === 'student') loadStudentHome();
    else loadTeacherHome();
  } else {
    showView('login-view');
  }
}

// ========== 注册 ==========
document.getElementById('btn-signup').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const role = document.getElementById('login-role').value;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return alert(error.message);
  await supabase.from('profiles').insert([{ id: data.user.id, email, role }]);
  alert('注册成功，请登录！');
});

// ========== 登录 ==========
document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return alert(error.message);
  currentUser = data.user;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
  currentProfile = profile;
  if (profile.role === 'student') loadStudentHome();
  else loadTeacherHome();
});

// ========== 学生加载单元列表 ==========
async function loadStudentHome() {
  showView('student-home');
  const { data: words } = await supabase.from('words').select('unit');
  const units = [...new Set(words.map(w => w.unit))];
  const unitList = document.getElementById('unit-list');
  unitList.innerHTML = '';
  units.forEach(unit => {
    const btn = document.createElement('button');
    btn.textContent = unit;
    btn.onclick = () => loadWordStudy(unit);
    unitList.appendChild(btn);
  });
}

// ========== 加载单词学习 ==========
async function loadWordStudy(unit) {
  showView('word-study');
  document.getElementById('study-title').textContent = unit;
  const { data: words } = await supabase.from('words').select('*').eq('unit', unit);
  const container = document.getElementById('word-cards');
  container.innerHTML = '';
  words.forEach(w => {
    const div = document.createElement('div');
    div.className = 'word-card';
    div.innerHTML = `
      <strong>${w.word}</strong> <span class="phonetic">${w.phonetic || ''}</span>
      <div class="meaning">${w.meaning}</div>
    `;
    container.appendChild(div);
  });
}

// ========== 教师端加载班级 ==========
async function loadTeacherHome() {
  showView('teacher-home');
  const { data: classes } = await supabase.from('classes').select('*').eq('teacher_id', currentProfile.id);
  const classList = document.getElementById('class-list');
  classList.innerHTML = '';
  if (classes) {
    classes.forEach(cls => {
      const btn = document.createElement('button');
      btn.textContent = cls.name + ' (邀请码: ' + cls.invite_code + ')';
      btn.onclick = () => loadClassStudents(cls.id);
      classList.appendChild(btn);
    });
  }
}

// ========== 教师查看班级学生 ==========
async function loadClassStudents(classId) {
  const { data: members } = await supabase.from('class_members').select('student_id').eq('class_id', classId);
  if (!members) return;
  const studentList = document.getElementById('student-detail');
  studentList.innerHTML = '<h3>学生列表</h3>';
  for (const m of members) {
    const { data: student } = await supabase.from('profiles').select('name, email').eq('id', m.student_id).single();
    const btn = document.createElement('button');
    btn.textContent = student?.name || student?.email;
    btn.onclick = () => loadStudentComments(m.student_id, classId);
    studentList.appendChild(btn);
  }
  showView('teacher-comment');
}

// ========== 教师查看学生点评 & 发送点评 ==========
let currentCommentStudentId = null;
let voiceBlob = null;

function loadStudentComments(studentId, classId) {
  currentCommentStudentId = studentId;
  document.getElementById('comment-text').value = '';
  supabase.from('comments').select('*').eq('student_id', studentId).order('created_at', { ascending: false })
    .then(({ data }) => {
      const container = document.getElementById('student-detail');
      container.innerHTML = '<h3>历史点评</h3>';
      if (data) {
        data.forEach(c => {
          const p = document.createElement('p');
          p.textContent = c.text_content || '[语音点评]';
          if (c.voice_url) {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = c.voice_url;
            p.appendChild(audio);
          }
          container.appendChild(p);
        });
      }
    });
  showView('teacher-comment');
}

document.getElementById('btn-send-comment').addEventListener('click', async () => {
  const text = document.getElementById('comment-text').value;
  if (!text && !voiceBlob) return alert('请输入文字或录制语音');
  let voiceUrl = null;
  if (voiceBlob) {
    const fileName = `comments/${Date.now()}.webm`;
    const { data, error } = await supabase.storage.from('voices').upload(fileName, voiceBlob);
    if (!error) voiceUrl = data.path;
  }
  await supabase.from('comments').insert([{
    teacher_id: currentProfile.id,
    student_id: currentCommentStudentId,
    task_id: null,
    text_content: text,
    voice_url: voiceUrl
  }]);
  alert('点评发送成功');
  voiceBlob = null;
  document.getElementById('comment-text').value = '';
});

// ========== 录音功能 ==========
let mediaRecorder;
document.getElementById('btn-record').addEventListener('click', async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    document.getElementById('btn-record').textContent = '🎤 开始录音';
    return;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  const chunks = [];
  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = () => {
    voiceBlob = new Blob(chunks, { type: 'audio/webm' });
  };
  mediaRecorder.start();
  document.getElementById('btn-record').textContent = '⏹ 停止录音';
});

// ========== 其他按钮 ==========
document.getElementById('btn-back-study').onclick = () => loadStudentHome();
document.getElementById('btn-back-comment').onclick = () => loadTeacherHome();
document.getElementById('btn-logout-student').onclick = () => { supabase.auth.signOut(); showView('login-view'); };
document.getElementById('btn-logout-teacher').onclick = () => { supabase.auth.signOut(); showView('login-view'); };
document.getElementById('btn-create-class').addEventListener('click', async () => {
  const name = prompt('班级名称？');
  if (!name) return;
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  await supabase.from('classes').insert([{ teacher_id: currentProfile.id, name, invite_code: code }]);
  loadTeacherHome();
});

// 启动
init();