// ========== 换成你自己的 Supabase 信息 ==========
const SUPABASE_URL = 'https://gzzkiynxaggepyqrjtdp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_I1y3k3O2cnH74CTVKIR-Dg_g-U047Nz';
// ===============================================

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;
let currentProfile = null;

// 视图切换
function showView(viewId) {
  document.querySelectorAll('section').forEach(s => s.style.display = 'none');
  document.getElementById(viewId).style.display = 'block';
}

// 初始化
async function init() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) console.log('未登录或令牌过期');
    if (user) {
      currentUser = user;
      const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profileError) {
        alert('获取用户资料失败：' + profileError.message);
        return;
      }
      currentProfile = profile;
      if (profile.role === 'student') loadStudentHome();
      else loadTeacherHome();
    } else {
      showView('login-view');
    }
  } catch (e) {
    alert('初始化错误：' + e.message);
  }
}

// 注册按钮
document.getElementById('btn-signup').addEventListener('click', async () => {
  try {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const role = document.getElementById('login-role').value;

    if (!email || !password) {
      alert('请填写邮箱和密码');
      return;
    }
    if (password.length < 6) {
      alert('密码至少需要6位');
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      alert('注册失败：' + error.message);
      return;
    }
    if (!data.user) {
      alert('注册未返回用户信息，可能是邮箱确认已开启。请在 Supabase 中暂时关闭邮箱确认。');
      return;
    }

    // 在 profiles 表中创建用户
    const { error: insertError } = await supabase.from('profiles').insert([
      { id: data.user.id, email: email, role: role }
    ]);
    if (insertError) {
      alert('用户资料保存失败：' + insertError.message);
      return;
    }
    alert('注册成功！请点击“登录”按钮登录。');
  } catch (e) {
    alert('注册时发生异常：' + e.message);
  }
});

// 登录按钮
document.getElementById('btn-login').addEventListener('click', async () => {
  try {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) {
      alert('请填写邮箱和密码');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert('登录失败：' + error.message);
      return;
    }
    currentUser = data.user;
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    if (profileError) {
      alert('获取用户资料失败：' + profileError.message + '（可能未完成注册或数据库RLS未配置）');
      return;
    }
    currentProfile = profile;
    if (profile.role === 'student') loadStudentHome();
    else loadTeacherHome();
  } catch (e) {
    alert('登录异常：' + e.message);
  }
});

// 学生加载单元
async function loadStudentHome() {
  showView('student-home');
  try {
    const { data: words, error } = await supabase.from('words').select('unit');
    if (error) {
      alert('获取单元失败：' + error.message);
      return;
    }
    const units = [...new Set(words.map(w => w.unit))];
    const unitList = document.getElementById('unit-list');
    unitList.innerHTML = '';
    units.forEach(unit => {
      const btn = document.createElement('button');
      btn.textContent = unit;
      btn.onclick = () => loadWordStudy(unit);
      unitList.appendChild(btn);
    });
  } catch (e) {
    alert('加载单元异常：' + e.message);
  }
}

// 加载单词学习
async function loadWordStudy(unit) {
  showView('word-study');
  document.getElementById('study-title').textContent = unit;
  try {
    const { data: words, error } = await supabase.from('words').select('*').eq('unit', unit);
    if (error) {
      alert('获取单词失败：' + error.message);
      return;
    }
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
  } catch (e) {
    alert('加载单词异常：' + e.message);
  }
}

// 教师端加载班级
async function loadTeacherHome() {
  showView('teacher-home');
  try {
    const { data: classes, error } = await supabase.from('classes').select('*').eq('teacher_id', currentProfile.id);
    if (error) {
      alert('获取班级失败：' + error.message);
      return;
    }
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
  } catch (e) {
    alert('加载班级异常：' + e.message);
  }
}

// 教师查看班级学生
async function loadClassStudents(classId) {
  try {
    const { data: members, error } = await supabase.from('class_members').select('student_id').eq('class_id', classId);
    if (error) {
      alert('获取班级成员失败：' + error.message);
      return;
    }
    if (!members) return;
    const studentList = document.getElementById('student-detail');
    studentList.innerHTML = '<h3>学生列表</h3>';
    for (const m of members) {
      const { data: student } = await supabase.from('profiles').select('name, email').eq('id', m.student_id).single();
      const btn = document.createElement('button');
      btn.textContent = student?.name || student?.email || '未知学生';
      btn.onclick = () => loadStudentComments(m.student_id, classId);
      studentList.appendChild(btn);
    }
    showView('teacher-comment');
  } catch (e) {
    alert('加载学生异常：' + e.message);
  }
}

// 教师查看学生点评 & 发送点评
let currentCommentStudentId = null;
let voiceBlob = null;

function loadStudentComments(studentId, classId) {
  currentCommentStudentId = studentId;
  document.getElementById('comment-text').value = '';
  supabase.from('comments').select('*').eq('student_id', studentId).order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) {
        alert('获取点评失败：' + error.message);
        return;
      }
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
  try {
    const text = document.getElementById('comment-text').value.trim();
    if (!text && !voiceBlob) {
      alert('请输入文字或录制语音');
      return;
    }
    let voiceUrl = null;
    if (voiceBlob) {
      const fileName = `comments/${Date.now()}.webm`;
      const { data, error } = await supabase.storage.from('voices').upload(fileName, voiceBlob);
      if (error) {
        alert('语音上传失败：' + error.message);
        return;
      }
      voiceUrl = data.path;
    }
    const { error } = await supabase.from('comments').insert([{
      teacher_id: currentProfile.id,
      student_id: currentCommentStudentId,
      task_id: null,
      text_content: text,
      voice_url: voiceUrl
    }]);
    if (error) {
      alert('点评发送失败：' + error.message);
      return;
    }
    alert('点评发送成功');
    voiceBlob = null;
    document.getElementById('comment-text').value = '';
  } catch (e) {
    alert('发送点评异常：' + e.message);
  }
});

// 录音
let mediaRecorder;
document.getElementById('btn-record').addEventListener('click', async () => {
  try {
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
  } catch (e) {
    alert('无法录音：' + e.message);
  }
});

// 其他按钮
document.getElementById('btn-back-study').onclick = () => loadStudentHome();
document.getElementById('btn-back-comment').onclick = () => loadTeacherHome();
document.getElementById('btn-logout-student').onclick = () => { supabase.auth.signOut(); showView('login-view'); };
document.getElementById('btn-logout-teacher').onclick = () => { supabase.auth.signOut(); showView('login-view'); };
document.getElementById('btn-create-class').addEventListener('click', async () => {
  const name = prompt('班级名称？');
  if (!name) return;
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { error } = await supabase.from('classes').insert([{ teacher_id: currentProfile.id, name, invite_code: code }]);
  if (error) alert('创建班级失败：' + error.message);
  else loadTeacherHome();
});

// 启动
init();
