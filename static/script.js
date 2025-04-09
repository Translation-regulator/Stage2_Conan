document.addEventListener("DOMContentLoaded", () => {
    // --------------------- 變數與初始化 ---------------------
    const list = document.querySelector(".list");
    const leftArrow = document.querySelector(".arrow:first-of-type");
    const rightArrow = document.querySelector(".arrow:last-of-type");
    const searchInput = document.querySelector("#search-input");
    const searchButton = document.querySelector("#search-button");
    const gridContainer = document.querySelector(".row-grid");
    const mrtListContainer = document.querySelector(".list");

    const scrollAmount = 1;
    let nextPage = 0;
    let isLoading = false;
    let lastKnownScrollPosition = 0;
    let ticking = false;

    // --------------------- Pop-up 訊息顯示工具 ---------------------
    function displayMessage(dialog, type, message) {
        // 在 .dialog-inner-content 中找到按鈕，並在它之前插入訊息元素
        const container = dialog.querySelector('.dialog-inner-content');
        let messageEl = container.querySelector('.dialog-message');
        if (!messageEl) {
          messageEl = document.createElement('div');
          messageEl.classList.add('dialog-message');
          // 將訊息插入在按鈕之前
          const button = container.querySelector('.dialog-btn');
          container.insertBefore(messageEl, button);
        }
        messageEl.textContent = message;
        messageEl.style.color = type === 'error' ? 'red' : 'green';
      }

    // 取得預定行程按鈕
    const reserveButton = document.querySelector(".nav-reserve");

    // 針對預定行程按鈕新增點擊事件
    reserveButton.addEventListener("click", () => {
        const token = localStorage.getItem('jwtToken');
        if (token) {
            // 如果有登入，則直接導向 booking.html
            window.location.href = "/booking";
        } else {
            // 如果未登入，則開啟登入的 pop-up 視窗
            dialogSignin.style.display = "block";
            dialogSignup.style.display = "none";
            dialogOverlay.classList.add("active");
        }
    });

    // --------------------- 點擊「台北一日遊」返回首頁 ---------------------
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

    // --------------------- 取得目前使用者資訊 ---------------------
    async function getUserInfo(token) {
        try {
          const response = await fetch('/api/user/auth', {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          // 可根據需求在頁面上顯示使用者名稱或其他資訊
        } catch (error) {
          console.error('取得使用者資訊失敗：', error);
        }
      }
      

    // --------------------- 登入狀態檢查與更新 ---------------------
    const loginButton = document.querySelector(".nav-login");
    function updateLoginStatus() {
        const token = localStorage.getItem('jwtToken');
        if (token) {
            loginButton.textContent = "登出系統";
            // 若需要，可呼叫 getUserInfo(token) 取得使用者資料
            getUserInfo(token);
        } else {
            loginButton.textContent = "登入/註冊";
        }
    }
    updateLoginStatus();

    // 修改 loginButton 點擊事件：已登入則登出，未登入則開啟 pop-up
    loginButton.addEventListener("click", () => {
        const token = localStorage.getItem('jwtToken');
        if (token) {
            // 登出流程
            localStorage.removeItem('jwtToken');
            updateLoginStatus();
            window.location.reload();
        } else {
            // 開啟 pop-up 登入畫面
            dialogSignin.style.display = "block";
            dialogSignup.style.display = "none";
            dialogOverlay.classList.add("active");
        }
    });

    // --------------------- 驗證電子信箱格式 ---------------------
    function validateEmail(email) {
        // 檢查是否符合 "xxx@xxx" 的簡單格式
        const regex = /^[^@]+@[^@]+$/;
        return regex.test(email);
    }

    // --------------------- 使用者註冊 ---------------------
    async function userSignup(name, email, password) {
        // 前端驗證：所有欄位必填
        if (!name || !email || !password) {
            displayMessage(dialogSignup, 'error', "請填寫完整的註冊資訊");
            return;
        }
        // 驗證電子信箱格式
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
                displayMessage(dialogSignup, 'error', "註冊錯誤：" + data.message);
            } else {
                displayMessage(dialogSignup, 'success', "註冊成功！");
                // 註冊成功後，1秒後切換到登入的 popup
                setTimeout(() => {
                    dialogSignup.style.display = "none";
                    dialogSignin.style.display = "block";
                    displayMessage(dialogSignup, 'success', "");
                }, 1000);
            }
        } catch (error) {
            console.error('註冊失敗：', error);
        }
    }

    // --------------------- 使用者登入 ---------------------
    async function userSignin(email, password) {
        // 前端驗證：檢查是否填寫且電子信箱格式正確
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
                // 登入成功直接跳轉回首頁
                window.location.href = "/";
            }
        } catch (error) {
            console.error('登入失敗：', error);
        }
    }



    // --------------------- 取得表單與按鈕 ---------------------
    const dialogOverlay = document.getElementById("dialog-overlay");
    const dialogCloseBtns = document.querySelectorAll(".dialog-close-btn");

    const dialogSignin = document.getElementById("dialog-signin");
    const dialogSignup = document.getElementById("dialog-signup");

    const toSignupBtn = document.getElementById("to-signup");
    const toSigninBtn = document.getElementById("to-signin");

    const signinInputs = dialogSignin.querySelectorAll(".input-group input");
    const signinBtn = dialogSignin.querySelector(".dialog-btn");

    const signupInputs = dialogSignup.querySelectorAll(".input-group input");
    const signupBtn = dialogSignup.querySelector(".dialog-btn");

    // --------------------- 開啟彈窗與關閉彈窗 ---------------------
    // （loginButton 的 click 事件已改為根據登入狀態處理）
    dialogCloseBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            dialogOverlay.classList.remove("active");
        });
    });

    // 刪除 dialogOverlay 的點擊事件，避免點擊遮罩層關閉
    
    toSignupBtn.addEventListener("click", () => {
        dialogSignin.style.display = "none";
        dialogSignup.style.display = "block";
    });
    
    toSigninBtn.addEventListener("click", () => {
        dialogSignin.style.display = "block";
        dialogSignup.style.display = "none";
    });

    // --------------------- 註冊與登入功能 ---------------------
    if (signinBtn) {
        signinBtn.addEventListener("click", () => {
            const email = signinInputs[0].value.trim();
            const password = signinInputs[1].value.trim();
            userSignin(email, password);
        });
    }

    if (signupBtn) {
        signupBtn.addEventListener("click", () => {
            const name = signupInputs[0].value.trim();
            const email = signupInputs[1].value.trim();
            const password = signupInputs[2].value.trim();
            userSignup(name, email, password);
        });
    }

    // --------------------- 左右箭頭與拖曳功能 ---------------------
    function addContinuousScroll(button, direction) {
        let intervalId;
        button.addEventListener("mousedown", () => {
            list.scrollLeft += direction === "left" ? -scrollAmount : scrollAmount;
            intervalId = setInterval(() => {
                list.scrollLeft += direction === "left" ? -10 : 10;
            }, 10);
        });

        button.addEventListener("mouseup", () => clearInterval(intervalId));
        button.addEventListener("mouseleave", () => clearInterval(intervalId));
    }

    addContinuousScroll(leftArrow, "left");
    addContinuousScroll(rightArrow, "right");

    // --------------------- MRT清單與篩選功能 ---------------------
    function loadMRTStations() {
        fetchData('/api/mrts').then(data => {
            mrtListContainer.innerHTML = '';
            data.data.forEach(mrt => {
                const mrtElement = document.createElement('div');
                mrtElement.textContent = mrt;
                mrtElement.classList.add('mrt-item');
                mrtElement.addEventListener("click", () => {
                    searchInput.value = mrt;
                    searchAttractions(mrt, true);
                });
                mrtListContainer.appendChild(mrtElement);
            });
        }).catch(error => console.error('Error fetching MRT stations:', error));
    }

    // --------------------- 關鍵字搜尋功能 ---------------------
    searchButton.addEventListener("click", () => searchAttractions(searchInput.value.trim(), false));
    searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") searchButton.click();
    });

    function searchAttractions(keyword, isMRTSearch = false) {
        nextPage = 0;
        gridContainer.innerHTML = '';
        loadAttractions(keyword, isMRTSearch);
    }

    // --------------------- 加載景點數據 ---------------------
    function loadAttractions(keyword, isMRTSearch = false) {
        if (isLoading || nextPage === null) return;
        isLoading = true;
    
        fetchData(`/api/attractions?page=${nextPage}&keyword=${keyword}`).then(data => {
            if (!data.data || data.data.length === 0) {
                isLoading = false;
                return;
            }
    
            data.data.forEach(attraction => {
                if (isMRTSearch && attraction.mrt !== keyword) return;
    
                const card = createAttractionCard(attraction);
                gridContainer.appendChild(card); 
            });
    
            nextPage = data.nextPage;
            isLoading = false;
        }).catch(error => {
            console.error("載入景點錯誤:", error);
            isLoading = false;
        });
    }
    
    function createAttractionCard(attraction) {
        const card = document.createElement("div");
        card.classList.add("grid-item");
    
        const imgContainer = document.createElement("div");
        imgContainer.classList.add("img-container");
    
        const link = document.createElement("a");
        link.href = `/attraction/${attraction.id}`;
    
        const img = document.createElement("img");
        img.src = attraction.images[0];  
        img.alt = attraction.name;
    
        link.appendChild(img);
        imgContainer.appendChild(link);
    
        const title = document.createElement("h3");
        title.textContent = attraction.name;
        title.classList.add("title-overlay");
    
        const infoBar = document.createElement("div");
        infoBar.classList.add("info-bar");
    
        const category = document.createElement("span");
        category.textContent = attraction.category;
        category.classList.add("info-text");
    
        const mrt = document.createElement("span");
        mrt.textContent = attraction.mrt;
        mrt.classList.add("info-text");
    
        imgContainer.appendChild(title);
        infoBar.appendChild(mrt);
        infoBar.appendChild(category);
    
        card.appendChild(imgContainer);
        card.appendChild(infoBar);
    
        return card;
    }

    // --------------------- 無限滾動 ---------------------
    function handleScroll() {
        lastKnownScrollPosition = window.scrollY;

        if (!ticking) {
            window.requestAnimationFrame(() => {
                const bottom = document.documentElement.scrollHeight - window.innerHeight;
                if (lastKnownScrollPosition >= bottom - 200 && nextPage !== null && !isLoading) {
                    loadAttractions(searchInput.value.trim(), false);
                }
                ticking = false;
            });
            ticking = true;
        }
    }

    window.addEventListener("scroll", handleScroll);

    // --------------------- MRT 站滑動功能 ---------------------
    function scrollMRTList(direction) {
        const visibleWidth = list.clientWidth;
        list.scrollLeft += direction === "left" ? -visibleWidth * 0.5 : visibleWidth * 0.5;
    }

    leftArrow.addEventListener("click", () => scrollMRTList("left"));
    rightArrow.addEventListener("click", () => scrollMRTList("right"));

    // --------------------- 初始載入 ---------------------
    loadMRTStations();
    loadAttractions('');

    const bottom = document.documentElement.scrollHeight - window.innerHeight;
    if (window.scrollY >= bottom - 200 && nextPage !== null && !isLoading) {
        loadAttractions('');
    }

    // --------------------- 通用的 fetch 函數 ---------------------
    function fetchData(url) {
        return fetch(url)
            .then(response => response.json())
            .catch(error => {
                console.error('Request failed', error);
                throw error;
            });
    }
});
