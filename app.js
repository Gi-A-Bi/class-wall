// ===================================================
// 우리 반 담벼락 - Firestore 연결판
//
// 메모가 Firestore(구글의 데이터 저장소)에 저장됩니다.
// 이제 새로고침해도, 다른 기기에서 열어도 메모가 그대로 있습니다.
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
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


// --- Firebase 설정 ---
// 이 값들은 브라우저에 그대로 보입니다. 비밀번호가 아니라 "우리 프로젝트 주소"입니다.
// 실제로 막아 주는 것은 Firestore 보안 규칙입니다. (백엔드 2 시간에 다룹니다)
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
      text: d.data().text
    };
  });
}

// 메모를 새로 씁니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
async function addMemo(text) {
  await addDoc(memosRef, {
    text: text,
    createdAt: serverTimestamp()   // 내 컴퓨터 시계가 아니라 서버 시계로 적습니다
  });
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


// ===================================================
// 화면 그리기
// ===================================================

async function render() {
  const wall = document.getElementById("wall");

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

  const del = document.createElement("button");
  del.textContent = "×";
  del.addEventListener("click", async function () {
    del.disabled = true;          // 두 번 눌려서 두 번 지워지는 일을 막습니다
    await deleteMemo(memo.id);
    await render();
  });
  div.appendChild(del);

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

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

    const text = input.value.trim();
    if (text === "") return;

    input.value = "";
    input.disabled = true;        // 저장하는 동안 잠깐 잠급니다

    await addMemo(text);
    await render();

    input.disabled = false;
    input.focus();
  }
});


// 첫 화면 그리기
render();
input.focus();
