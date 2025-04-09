// 取用 DOM 元素
const dateInput = document.querySelector('#order');
const optionA = document.querySelector('#optionA');
const optionB = document.querySelector('#optionB');
const feeLabel = document.querySelector('.fee-label .currency');
const imageContainer = document.querySelector('.attraction-image');

// 用於儲存箭頭與點點的容器，直接插入圖片容器內
const imageNav = document.createElement('div');
imageNav.classList.add('image-nav');
const imageDots = document.createElement('div');
imageDots.classList.add('image-dots');

let currentImageIndex = 0;
let images = []; // 儲存景點圖片
let attractionId = window.location.pathname.split('/').pop();

// 點擊「台北一日遊」返回首頁
function homepage(className) {
  const button = document.querySelector(`.${className}`);
  if (button) {
    button.addEventListener("click", () => {
      window.location.href = "/";
    });
  } else {
    console.error(`Element with class "${className}" not found.`);
  }
}
homepage("nav-title");

// 初始載入景點資料與事件
window.addEventListener('load', () => {
  fetchAttractionDetails(attractionId);
  setupEventListeners();
});

// 綁定景點選項事件
function setupEventListeners() {
  optionA.addEventListener('change', updateFee);
  optionB.addEventListener('change', updateFee);
}

function updateFee() {
  const fee = optionA.checked ? 2000 : 2500;
  feeLabel.textContent = `新台幣${fee}元`;
}

async function fetchAttractionDetails(attractionId) {
  try {
    const response = await fetch(`/api/attraction/${attractionId}`);
    const data = await response.json();
    if (data.data) {
      const attraction = data.data;
      renderAttractionDetails(attraction);
    } else {
      alert('無法載入景點資料');
    }
  } catch (error) {
    console.error('Error fetching attraction details:', error);
  }
}

function renderAttractionDetails(attraction) {
  const { name, category, mrt, description, address, transport, images: attractionImages } = attraction;
  
  const attractionTitle = document.querySelector('.attraction-title');
  const attractionCategoryMRT = document.querySelector('.attraction-category-mrt');
  const attractionDescription = document.querySelector('.attraction-description');
  const descriptionAddress = document.querySelector('.attraction-address');
  const descriptionTransport = document.querySelector('.attraction-transport');

  attractionTitle.textContent = name;
  attractionCategoryMRT.innerHTML = `${category} <span>at ${mrt}</span>`;
  attractionDescription.textContent = description;
  descriptionAddress.textContent = address;
  descriptionTransport.textContent = transport;

  images = attractionImages;
  renderImageSlideshow();
}

function renderImageSlideshow() {
  // 設定第一張圖片
  imageContainer.style.backgroundImage = `url(${images[currentImageIndex]})`;

  // 建立箭頭 (插入到圖片容器內)
  const arrowLeft = document.createElement('span');
  arrowLeft.classList.add('arrow-left');
  arrowLeft.title = "上一張";
  
  const arrowRight = document.createElement('span');
  arrowRight.classList.add('arrow-right');
  arrowRight.title = "下一張";

  imageNav.appendChild(arrowLeft);
  imageNav.appendChild(arrowRight);
  imageContainer.appendChild(imageNav);

  // 建立點點，並用 title 提示目前第幾張
  imageDots.innerHTML = ''; // 清空先前的點點
  images.forEach((img, index) => {
    const dot = document.createElement('span');
    dot.classList.add('dot');
    if (index === currentImageIndex) dot.classList.add('active');
    dot.title = `第 ${index + 1} 張`;
    dot.addEventListener('click', () => changeImage(index));
    imageDots.appendChild(dot);
  });
  imageContainer.appendChild(imageDots);

  // 綁定箭頭事件
  arrowLeft.addEventListener('click', () => changeImage(currentImageIndex - 1));
  arrowRight.addEventListener('click', () => changeImage(currentImageIndex + 1));
}

function changeImage(index) {
  if (index < 0) {
    currentImageIndex = images.length - 1;
  } else if (index >= images.length) {
    currentImageIndex = 0;
  } else {
    currentImageIndex = index;
  }
  imageContainer.style.backgroundImage = `url(${images[currentImageIndex]})`;
  updateDotStyle();
}

function updateDotStyle() {
  const dots = imageDots.querySelectorAll('.dot');
  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index === currentImageIndex);
  });
}

// --------------------- 登入/註冊與預訂行程功能 ---------------------

// 取得右上角「登入/註冊」按鈕與彈窗相關 DOM
const loginButton = document.querySelector(".nav-login");
const reserveButton = document.querySelector(".nav-reserve");
const dialogOverlay = document.getElementById("dialog-overlay");
const dialogCloseBtns = document.querySelectorAll(".dialog-close-btn");

// 取得表單切換的彈窗
const dialogSignin = document.getElementById("dialog-signin");
const dialogSignup = document.getElementById("dialog-signup");
const toSignupBtn = document.getElementById("to-signup");
const toSigninBtn = document.getElementById("to-signin");

// 取得登入與註冊表單中的輸入欄位與按鈕
const signinInputs = dialogSignin.querySelectorAll(".input-group input");
const signinBtn = dialogSignin.querySelector(".dialog-btn");

const signupInputs = dialogSignup.querySelectorAll(".input-group input");
const signupBtn = dialogSignup.querySelector(".dialog-btn");

// 更新使用者登入狀態
function updateLoginStatus() {
  const token = localStorage.getItem('jwtToken');
  if (token) {
    loginButton.textContent = "登出系統";
    // 你也可以呼叫 getUserInfo(token) 取得更多使用者資訊
  } else {
    loginButton.textContent = "登入/註冊";
  }
}
updateLoginStatus();

// 登入/登出按鈕點擊行為：若已登入則登出，未登入則顯示登入彈窗
loginButton.addEventListener("click", () => {
  const token = localStorage.getItem('jwtToken');
  if (token) {
    // 登出流程
    localStorage.removeItem('jwtToken');
    updateLoginStatus();
    window.location.reload();
  } else {
    // 顯示登入彈窗
    dialogSignin.style.display = "block";
    dialogSignup.style.display = "none";
    dialogOverlay.classList.add("active");
  }
});

// 針對預定行程按鈕（.nav-reserve）也進行綁定
if (reserveButton) {
  reserveButton.addEventListener("click", () => {
    const token = localStorage.getItem('jwtToken');
    if (token) {
      // 若已登入則直接導向 booking 頁面
      window.location.href = "/booking";
    } else {
      // 未登入則跳出登入彈窗
      dialogSignin.style.display = "block";
      dialogSignup.style.display = "none";
      dialogOverlay.classList.add("active");
    }
  });
} else {
  console.error("無法找到 .nav-reserve 元素，請確認 HTML 結構");
}

// 關閉彈窗按鈕點擊事件
dialogCloseBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    dialogOverlay.classList.remove("active");
  });
});
// (可選) 點擊遮罩層也關閉彈窗
dialogOverlay.addEventListener("click", (event) => {
  if (event.target === dialogOverlay) {
    dialogOverlay.classList.remove("active");
  }
});

// 切換表單
toSignupBtn.addEventListener("click", () => {
  dialogSignin.style.display = "none";
  dialogSignup.style.display = "block";
});
toSigninBtn.addEventListener("click", () => {
  dialogSignin.style.display = "block";
  dialogSignup.style.display = "none";
});

// 輔助函式：驗證電子信箱格式
function validateEmail(email) {
  const regex = /^[^@]+@[^@]+$/;
  return regex.test(email);
}

// 輔助函式：在彈窗中顯示訊息
function displayMessage(dialog, type, message) {
  const container = dialog.querySelector('.dialog-inner-content');
  let messageEl = container.querySelector('.dialog-message');
  if (!messageEl) {
    messageEl = document.createElement('div');
    messageEl.classList.add('dialog-message');
    const button = container.querySelector('.dialog-btn');
    container.insertBefore(messageEl, button);
  }
  messageEl.textContent = message;
  messageEl.style.color = type === 'error' ? 'red' : 'green';
}

// 登入功能
async function userSignin(email, password) {
  if (!email || !password) {
    displayMessage(dialogSignin, 'error', "請填寫完整的登入資訊");
    return;
  }
  if (!validateEmail(email)) {
    displayMessage(dialogSignin, 'error', "請輸入符合格式的電子信箱");
    return;
  }
  try {
    const response = await fetch('/api/user/auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (data.error) {
      displayMessage(dialogSignin, 'error', "請輸入正確的電子信箱或密碼");
    } else {
      localStorage.setItem('jwtToken', data.token);
      updateLoginStatus();
      // 登入成功後重新導向回目前景點頁面
      window.location.href = `/attraction/${attractionId}`;
    }
  } catch (error) {
    console.error('登入失敗：', error);
  }
}

// 綁定登入按鈕事件
if (signinBtn) {
  signinBtn.addEventListener("click", () => {
    const email = signinInputs[0].value.trim();
    const password = signinInputs[1].value.trim();
    userSignin(email, password);
  });
}

// 註冊功能
async function userSignup(name, email, password) {
  if (!name || !email || !password) {
    displayMessage(dialogSignup, 'error', "請填寫完整的註冊資訊");
    return;
  }
  if (!validateEmail(email)) {
    displayMessage(dialogSignup, 'error', "請輸入符合格式的電子信箱");
    return;
  }
  try {
    const response = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await response.json();
    if (data.error) {
      displayMessage(dialogSignup, 'error', data.message);
    } else {
      displayMessage(dialogSignup, 'success', "註冊成功！");
      // 註冊成功後，1秒後切換到登入的 popup
      setTimeout(() => {
        dialogSignup.style.display = "none";
        dialogSignin.style.display = "block";
      }, 1000);
    }
  } catch (error) {
    console.error('註冊失敗：', error);
  }
}

// 綁定註冊按鈕事件
if (signupBtn) {
  signupBtn.addEventListener("click", () => {
    const name = signupInputs[0].value.trim();
    const email = signupInputs[1].value.trim();
    const password = signupInputs[2].value.trim();
    userSignup(name, email, password);
  });
}

// --------------------- 預訂行程功能 ---------------------

// 取得「開始預約行程」按鈕
const startBookingBtn = document.querySelector('#startBooking');

// 綁定「開始預約行程」的點擊事件
startBookingBtn.addEventListener('click', async () => {
  const token = localStorage.getItem('jwtToken');
  if (!token) {
    // 未登入則呼叫登入彈窗
    dialogSignin.style.display = "block";
    dialogSignup.style.display = "none";
    dialogOverlay.classList.add("active");
    return;
  }

  // 收集預訂行程所需的資料：景點 ID、日期、時段與費用
  const bookingData = {
    attractionId: Number(attractionId),
    date: dateInput.value,
    time: optionA.checked ? "morning" : "afternoon",
    price: optionA.checked ? 2000 : 2500
  };

  try {
    const response = await fetch('/api/booking', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(bookingData)
    });
    const result = await response.json();

    if (response.ok && result.ok) {
      // 預訂成功導向預訂行程頁面
      window.location.href = "/booking";
    } else {
      alert(result.message || "建立預訂行程失敗");
    }
  } catch (error) {
    console.error("建立預訂行程失敗：", error);
  }
});
