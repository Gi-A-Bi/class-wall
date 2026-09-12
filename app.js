// ===================================================
// 우리 반 담벼락 - Firestore + 구글 로그인판
//
// 메모가 Firestore(구글의 데이터 저장소)에 저장됩니다.
// 이제 새로고침해도, 다른 기기에서 열어도 메모가 그대로 있습니다.
// 구글 계정으로 로그인하면, 누가 쓴 메모인지도 함께 저장됩니다.
// 교사는 모든 메모를, 학생은 자기 메모만 지울 수 있습니다.
// ===================================================


// --- Firebase 불러오기 ---
// npm 설치 없이, 구글 서버에서 바로 가져옵니다. (CDN 방식)
// 쓰는 기능만 골라서 가져오는 것이 v9 modular 방식입니다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// 로그인에 쓰는 기능들입니다. (Authentication = 인증, 이 사람이 맞는지 확인하는 일)
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


// --- Firebase 설정 ---
// 이 값들은 브라우저에 그대로 보입니다. 비밀번호가 아니라 "우리 프로젝트 주소"입니다.
// 실제로 막아 주는 것은 Firestore 보안 규칙입니다. (firestore.rules 파일을 보세요)
const firebaseConfig = {
  apiKey: "AIzaSyBGAI_ki6TIYZ0EWKCYj2uQQOkHAfX1m-c",
  authDomain: "class-wall-83e25.firebaseapp.com",
  projectId: "class-wall-83e25",
  storageBucket: "class-wall-83e25.firebasestorage.app",
  messagingSenderId: "818138273106",
  appId: "1:818138273106:web:7422b53055d9a8cbf9d68b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);   // 로그인을 담당하는 부분입니다

// 메모가 모여 있는 곳입니다. Firestore에서는 이것을 "컬렉션"이라고 부릅니다.
const memosRef = collection(db, "memos");


// ===================================================
// 데이터를 다루는 함수 세 개
//
// 서버에 다녀오는 일이라 시간이 걸립니다.
// 그래서 async 를 붙이고, 부를 때는 앞에 await 를 붙입니다.
// (await = "끝날 때까지 기다렸다가 다음 줄")
// ===================================================

// 메모를 읽어 옵니다.
// orderBy("createdAt") 으로 쓴 순서대로 가져옵니다.
async function loadMemos() {
  const q = query(memosRef, orderBy("createdAt"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(function (d) {
    return {
      id: d.id,            // Firestore가 붙여 준 문서 이름입니다 (숫자가 아니라 글자)
      text: d.data().text,
      uid: d.data().uid,   // 누가 썼는지 (로그인 붙이기 전에 쓴 메모에는 없습니다)
      name: d.data().name  // 담벼락에 보일 이름
    };
  });
}

// 메모를 새로 씁니다.
// 글 내용만이 아니라 "누가 썼는지"도 함께 저장합니다.
// (currentUser 는 아래 "구글 로그인" 칸에 있습니다)
async function addMemo(text) {
  await addDoc(memosRef, {
    text: text,
    uid: currentUser.uid,              // 구글이 사람마다 하나씩 붙여 준 번호입니다. 바뀌지 않습니다.
    name: currentUser.displayName,     // 담벼락에 보일 이름입니다
    createdAt: serverTimestamp()       // 내 컴퓨터 시계가 아니라 서버 시계로 적습니다
  });
}

// 메모를 지웁니다.
// 남의 메모를 지우려고 하면 보안 규칙(firestore.rules)이 막아 줍니다.
// 그때는 오류가 나면서 아래 catch 로 갑니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


// ===================================================
// 화면 그리기
// ===================================================

async function render() {
  const wall = document.getElementById("wall");

  // 담벼락은 로그인한 사람만 볼 수 있습니다. (보안 규칙에 그렇게 적어 두었습니다)
  if (currentUser === null) {
    wall.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = "로그인하면 담벼락이 보입니다.";
    wall.appendChild(p);
    return;
  }

  try {
    const memos = await loadMemos();          // 다 받아온 다음에

    wall.innerHTML = "";                      // 화면을 비우고
    memos.forEach(function (memo) {           // 다시 그립니다
      wall.appendChild(makeMemo(memo));
    });
  } catch (e) {
    // 규칙에 막히거나 인터넷이 끊기면 여기로 옵니다.
    wall.innerHTML = "";
    const p = document.createElement("p");
    p.className = "notice";
    p.textContent = "메모를 불러오지 못했습니다: " + (e.code || e.message);
    wall.appendChild(p);
    console.error(e);
  }
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  // 지울 수 있는 사람에게만 × 버튼을 답니다.
  if (canDelete(memo)) {
    const del = document.createElement("button");
    del.textContent = "×";

    del.addEventListener("click", async function () {
      del.disabled = true;        // 두 번 눌려서 두 번 지워지는 일을 막습니다

      try {
        await deleteMemo(memo.id);
      } catch (e) {
        // 규칙에 막히면 여기로 옵니다. (permission-denied)
        alert("이 메모는 지울 수 없습니다: " + (e.code || e.message));
        del.disabled = false;
        return;
      }

      await render();
    });

    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  // 누가 썼는지 적어 줍니다.
  const who = document.createElement("div");
  who.className = "who";
  who.textContent = memo.name || "이름 없음";
  div.appendChild(who);

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    if (currentUser === null) return;   // 로그인하지 않았으면 쓰지 않습니다

    const text = input.value.trim();
    if (text === "") return;

    input.value = "";
    input.disabled = true;        // 저장하는 동안 잠깐 잠급니다

    try {
      await addMemo(text);
      await render();
    } catch (e) {
      alert("메모를 쓰지 못했습니다: " + (e.code || e.message));
      input.value = text;         // 쓴 글이 사라지지 않게 돌려 놓습니다
      console.error(e);
    }

    input.disabled = false;
    input.focus();
  }
});


// ===================================================
// 구글 로그인
//
// 우리가 비밀번호를 받지 않습니다. 구글 창이 떠서 구글이 받습니다.
// 확인이 끝나면 구글이 "이 사람 맞다"고 알려 주고, 그 사람 정보만 넘어옵니다.
// ===================================================

const provider = new GoogleAuthProvider();   // "구글 계정으로 로그인하겠다"는 뜻입니다
const userArea = document.getElementById("userArea");

// 지금 로그인한 사람입니다. 로그인 전에는 null 입니다.
let currentUser = null;

// 이 사람의 역할입니다. "teacher" 또는 "student", 로그인 전에는 null 입니다.
let currentRole = null;


// ===================================================
// 교사와 학생 나누기
//
// 역할은 Firestore 의 roles 칸에 적혀 있습니다. 문서 이름이 그 사람의 uid 입니다.
//   roles/{uid} 에 role: "teacher" 가 있으면 교사
//   문서가 없으면 학생
//
// 이 칸은 Firebase 콘솔에서만 만듭니다. 앱에서는 읽기만 합니다.
// 그래야 학생이 스스로 교사가 되는 일이 없습니다. (firestore.rules 를 보세요)
// ===================================================

async function loadRole(user) {
  if (user === null) return null;

  try {
    const snap = await getDoc(doc(db, "roles", user.uid));
    if (snap.exists() && snap.data().role === "teacher") return "teacher";
  } catch (e) {
    // 못 읽으면 학생으로 봅니다. 권한을 함부로 주지 않기 위해서입니다.
    console.error(e);
  }

  return "student";
}

// 이 메모를 지울 수 있는 사람인지 봅니다.
// 교사는 모든 메모를, 학생은 자기가 쓴 메모만 지웁니다.
//
// 여기서 하는 일은 버튼을 "안 보이게" 하는 것뿐입니다.
// 진짜로 막아 주는 것은 서버에 있는 보안 규칙입니다. (firestore.rules)
function canDelete(memo) {
  if (currentUser === null) return false;
  if (currentRole === "teacher") return true;
  return memo.uid === currentUser.uid;
}

// 로그인 창을 띄웁니다.
function login() {
  signInWithPopup(auth, provider).catch(function (e) {
    // 창을 그냥 닫았을 때도 여기로 옵니다. 잘못한 게 아니니 조용히 넘깁니다.
    if (e.code === "auth/popup-closed-by-user") return;
    if (e.code === "auth/cancelled-popup-request") return;
    alert("로그인하지 못했습니다: " + e.code);
    console.error(e);
  });
}

// 로그아웃합니다.
function logout() {
  signOut(auth);
}

// 화면 위쪽 로그인 칸을 그립니다.
// 로그인 전에는 버튼만, 로그인 후에는 이름과 로그아웃 버튼이 보입니다.
function renderUserArea() {
  userArea.innerHTML = "";

  if (currentUser === null) {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "구글로 로그인";
    loginBtn.addEventListener("click", login);
    userArea.appendChild(loginBtn);
    return;
  }

  const name = document.createElement("span");
  const label = (currentRole === "teacher") ? "교사" : "학생";
  name.textContent = currentUser.displayName + " 님 (" + label + ") ";
  userArea.appendChild(name);

  const logoutBtn = document.createElement("button");
  logoutBtn.textContent = "로그아웃";
  logoutBtn.addEventListener("click", logout);
  userArea.appendChild(logoutBtn);
}

// 로그인하지 않았으면 메모 쓰는 칸을 잠급니다.
function updateWriter() {
  if (currentUser === null) {
    input.disabled = true;
    input.placeholder = "로그인하면 메모를 쓸 수 있습니다";
    return;
  }

  input.disabled = false;
  input.placeholder = "메모를 쓰고 엔터";
  input.focus();
}


// ===================================================
// 첫 화면 그리기
//
// 로그인 상태를 알아야 화면을 그릴 수 있습니다.
// onAuthStateChanged 는 로그인 상태가 바뀔 때마다 자동으로 불립니다.
// 페이지를 처음 열 때도 한 번 불립니다.
// (지난번 로그인이 남아 있으면 로그인한 상태로, 없으면 null 로 들어옵니다)
// ===================================================

onAuthStateChanged(auth, async function (user) {
  currentUser = user;              // 로그인했으면 그 사람 정보, 로그아웃했으면 null
  currentRole = await loadRole(user);   // 교사인지 학생인지 먼저 알아 옵니다

  renderUserArea();
  updateWriter();
  render();
});
