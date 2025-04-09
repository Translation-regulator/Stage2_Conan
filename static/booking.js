document.addEventListener("DOMContentLoaded", () => {
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

  // --------------------- 登入/登出功能 ---------------------
  const loginButton = document.querySelector(".nav-login");
  function updateLoginStatus() {
    const token = localStorage.getItem("jwtToken");
    if (token) {
      loginButton.textContent = "登出系統";
    } else {
      loginButton.textContent = "登入/註冊";
    }
  }
  updateLoginStatus();
  loginButton.addEventListener("click", () => {
    const token = localStorage.getItem("jwtToken");
    if (token) {
      // 登出流程：清除 token 並重新載入頁面
      localStorage.removeItem("jwtToken");
      updateLoginStatus();
      window.location.reload();
    } else {
      // 若未登入，導向登入頁面或顯示登入彈窗（依專案需求決定）
      window.location.href = "/login"; // 或改成開啟登入彈窗
    }
  });

  // --------------------- 驗證登入狀態 ---------------------
  const token = localStorage.getItem("jwtToken");
  if (!token) {
    // 沒有登入則導向首頁（或其它指定頁面）
    window.location.href = "/";
    return;
  }

  // --------------------- 取得預定行程資訊 ---------------------
  async function fetchBookingInfo() {
    try {
      const response = await fetch("/api/booking", {
        method: "GET",
        headers: { Authorization: "Bearer " + token },
      });
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();

      if (data.data) {
        updateBookingPage(data.data);
      } else {
        console.log("目前沒有任何預定行程");
        // 顯示「空」狀態，隱藏其他區塊
        document.querySelector(".booking-empty").style.display = "block";
        document.querySelector(".booking").style.display = "none";
        document.querySelector(".contact-info").style.display = "none";
        document.querySelector(".credit-card-info").style.display = "none";
        document.querySelector(".booking-terms").style.display = "none";
        document.querySelectorAll(".booking-hr").forEach(hr => hr.style.display = "none");

        // ===== 新增這裡：取使用者名稱並顯示 =====
        const userRes = await fetch("/api/user/auth", {
          method: "GET",
          headers: { Authorization: "Bearer " + token },
        });
        if (userRes.ok) {
          const userJson = await userRes.json();
          const userName = userJson.data?.name || "使用者";
          const header = document.querySelector("header.section-container");
          if (header) {
            header.textContent = `您好，${userName}，目前沒有任何預定行程`;
          }
        }
      }
    } catch (error) {
      console.error("取得預定行程失敗：", error);
    }
  }
  fetchBookingInfo();

  // --------------------- 更新預定行程頁面 ---------------------
  function updateBookingPage(bookingInfo) {
    // 使用者名稱
    const header = document.querySelector("header.section-container");
    const userName = bookingInfo.userName || "使用者";
    if (header) {
      header.textContent = `您好，${userName}，待預定的行程如下：`;
    }

    // 景點名稱
    const bookingTitle = document.querySelector(".booking-title");
    if (bookingTitle && bookingInfo.attraction.name) {
      bookingTitle.textContent = `台北一日遊：${bookingInfo.attraction.name}`;
    }

    // 時間
    const bookingTime = document.querySelector(".booking-time");
    if (bookingTime && bookingInfo.time) {
      const timeText =
        bookingInfo.time === "morning"
          ? "早上9點到下午4點"
          : bookingInfo.time === "afternoon"
          ? "下午2點到晚上9點"
          : "全天";
      bookingTime.innerHTML = `<span>時間：</span>${timeText}`;
    }

    // 地址
    const bookingAddress = document.querySelector(".booking-address");
    if (bookingAddress && bookingInfo.attraction.address) {
      bookingAddress.innerHTML = `<span>地點：</span>${bookingInfo.attraction.address}`;
    }

    // 日期
    const bookingDate = document.querySelector(".booking-date");
    if (bookingDate && bookingInfo.date) {
      bookingDate.innerHTML = `<span>日期：</span>${bookingInfo.date}`;
    }

    // 圖片
    const bookingImage = document.querySelector(".booking-image");
    if (bookingImage && bookingInfo.attraction.image) {
      bookingImage.src = bookingInfo.attraction.image;
    }

    // 價格（原有費用區塊更新）
    const bookingPrice = document.querySelector(".booking-price");
    if (bookingPrice && bookingInfo.price) {
      bookingPrice.innerHTML = `<span>費用：</span>新台幣${bookingInfo.price}元`;
    }
    
    // --------------------- 更新 booking-fee（總價） ---------------------
    const bookingFee = document.querySelector(".booking-fee");
    if (bookingFee && bookingInfo.price) {
      bookingFee.textContent = `總價：新台幣${bookingInfo.price}元`;
    }

    // --------------------- 刪除預定行程功能 ---------------------
    const deleteIcon = document.querySelector(".delete-icon");
    if (deleteIcon) {
      deleteIcon.addEventListener("click", async () => {
        try {
          const response = await fetch("/api/booking", {
            method: "DELETE",
            headers: {
              Authorization: "Bearer " + token,
            },
          });

          if (!response.ok) {
            throw new Error("Network response was not ok");
          }

          const result = await response.json();
          if (result.ok) {
            // 清除畫面資訊
            document.querySelector(".booking").style.display = "none";
            sessionStorage.removeItem("bookingInfo");

            // 顯示空狀態頁面
            document.querySelector(".booking-empty").style.display = "block";
            document.querySelector(".contact-info").style.display = "none";
            document.querySelector(".credit-card-info").style.display = "none";
            document.querySelector(".booking-terms").style.display = "none";
            document.querySelectorAll(".booking-hr").forEach((hr) => {
              hr.style.display = "none";
            });

            console.log("預定行程已刪除");
          }
        } catch (error) {
          console.error("刪除預定行程失敗：", error);
        }
      });
    }
  }

  // --------------------- 從 sessionStorage 載入預定資訊（可選） ---------------------
  const bookingInfoStr = sessionStorage.getItem("bookingInfo");
  if (bookingInfoStr) {
    const bookingInfo = JSON.parse(bookingInfoStr);
    updateBookingPage(bookingInfo);
  }

  // --------------------- 自動填入聯絡人姓名與 Email ---------------------
  async function fillContactInfo() {
    try {
      const response = await fetch("/api/user/auth", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      if (!response.ok) {
        throw new Error("無法取得使用者資訊");
      }

      const result = await response.json();
      if (result.data) {
        const userNameInput = document.getElementById("name");
        const userEmailInput = document.getElementById("email");

        if (userNameInput && result.data.name) {
          userNameInput.value = result.data.name;
        }
        if (userEmailInput && result.data.email) {
          userEmailInput.value = result.data.email;
        }
      }
    } catch (error) {
      console.error("載入使用者資料失敗：", error);
    }
  }

  fillContactInfo();
});
