document.addEventListener("DOMContentLoaded", () => {
    // --------------------- 變數與初始化 ---------------------
    const list = document.querySelector(".list");
    const leftArrow = document.querySelector(".arrow:first-of-type");
    const rightArrow = document.querySelector(".arrow:last-of-type");
    const searchInput = document.querySelector("#search-input");  
    const searchButton = document.querySelector("#search-button");  
    const gridContainer = document.querySelector(".row-grid");
    const mrtListContainer = document.querySelector(".list"); 
    
    const scrollAmount = 1; // 每次點擊滾動距離
    let nextPage = 0; // 初始化第一頁
    let isLoading = false; // 防止重複請求
    let lastKnownScrollPosition = 0; // 最後一次滾動位置
    let ticking = false; // 防止重複觸發滾動事件

    // --------------------- 左右箭頭與拖曳功能 ---------------------
    function addContinuousScroll(button, direction) {
        let timeoutId;
        let intervalId;

        button.addEventListener("mousedown", () => {
            // 短按立即滾動一步
            if (direction === "left") {
                list.scrollLeft -= scrollAmount;
            } else {
                list.scrollLeft += scrollAmount;
            }

            // 設定延遲 100 毫秒後開始持續滾動
            timeoutId = setTimeout(() => {
                intervalId = setInterval(() => {
                    if (direction === "left") {
                        list.scrollLeft -= 10; // 增加每次滾動的距離
                    } else {
                        list.scrollLeft += 10;
                    }
                }, 10); // 每 10 毫秒滾動一次
            }, 100); // 延遲開始連續滾動
        });

        // 釋放或離開按鈕時，清除定時器
        button.addEventListener("mouseup", () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
        });
        button.addEventListener("mouseleave", () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
        });
    }

    addContinuousScroll(leftArrow, "left");
    addContinuousScroll(rightArrow, "right");

    // --------------------- MRT清單與篩選功能 ---------------------
    function loadMRTStations() {
        fetch('/api/mrts')
            .then(response => response.json())
            .then(data => {
                // 清空 MRT 清單，避免重複載入
                mrtListContainer.innerHTML = "";
                const mrtList = data.data;
                mrtList.forEach(mrt => {
                    const mrtElement = document.createElement('div');
                    mrtElement.textContent = mrt;
                    mrtElement.classList.add('mrt-item');
                    mrtElement.addEventListener("click", () => {
                        // 當選擇 MRT 站時，將 MRT 站名放入搜尋框並以 MRT 模式觸發搜尋，
                        // 這裡傳入第二個參數 true 表示「精準依據 attraction.mrt 進行比對」
                        searchInput.value = mrt;
                        searchAttractions(mrt, true);
                    });
                    mrtListContainer.appendChild(mrtElement);
                });
            })
            .catch(error => console.error('Error fetching MRT stations:', error));
    }

    // --------------------- 關鍵字搜尋功能 ---------------------
    searchButton.addEventListener("click", () => {
        const keyword = searchInput.value.trim();
        if (keyword) {
            // 預設為一般關鍵字搜尋
            searchAttractions(keyword, false);
        }
    });

    // 搜尋景點函式，第二個參數 isMRTSearch 預設為 false，
    // 若為 true 則代表以 MRT 站名作為精準搜尋條件
    function searchAttractions(keyword, isMRTSearch = false) {
        nextPage = 0;  // 重置為頁面1
        gridContainer.innerHTML = '';  // 清空現有的列表
        loadAttractions(keyword, isMRTSearch);
    }

    // --------------------- 加載景點數據 ---------------------
    function loadAttractions(keyword, isMRTSearch = false) {
        if (isLoading || nextPage === null) return;
        isLoading = true;

        fetch(`/api/attractions?page=${nextPage}&keyword=${keyword}`)
            .then(response => response.json())
            .then(data => {
                if (!data.data || data.data.length === 0) {
                    isLoading = false;
                    return;
                }

                data.data.forEach(attraction => {
                    // 如果是 MRT 搜尋，僅保留 attraction.mrt 與 keyword 完全相符的資料
                    if (isMRTSearch && attraction.mrt !== keyword) {
                        return;
                    }

                    const card = document.createElement("div");
                    card.classList.add("grid-item");

                    const imgContainer = document.createElement("div");
                    imgContainer.classList.add("img-container");

                    const img = document.createElement("img");
                    img.src = attraction.image;
                    img.alt = attraction.name;

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

                    imgContainer.appendChild(img);
                    imgContainer.appendChild(title);
                    infoBar.appendChild(mrt);
                    infoBar.appendChild(category);

                    card.appendChild(imgContainer);
                    card.appendChild(infoBar);

                    gridContainer.appendChild(card);
                });

                nextPage = data.nextPage;
                isLoading = false;
            })
            .catch(error => {
                console.error("載入景點錯誤:", error);
                isLoading = false;
            });
    }

    // --------------------- 滾動事件與無限滾動 ---------------------
    function handleScroll() {
        lastKnownScrollPosition = window.scrollY;

        if (!ticking) {
            window.requestAnimationFrame(() => {
                const bottom = document.documentElement.scrollHeight - window.innerHeight;
                if (lastKnownScrollPosition >= bottom - 200 && nextPage !== null && !isLoading) {
                    // 若使用者在一般搜尋狀態，直接以目前輸入框內容搜尋
                    // 若為 MRT 搜尋，可根據需求決定是否持續 MRT 模式（此範例預設一般搜尋）
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
        const scrollAmount = direction === "left" ? -visibleWidth * 0.5 : visibleWidth * 0.5;
        list.scrollLeft += scrollAmount;
    }

    leftArrow.addEventListener("click", () => scrollMRTList("left"));
    rightArrow.addEventListener("click", () => scrollMRTList("right"));

    // --------------------- 初始載入 MRT 站與景點數據 ---------------------
    loadMRTStations();
    loadAttractions(''); // 預設載入所有景點

    // 檢查頁面是否自動滾動到底部
    const bottom = document.documentElement.scrollHeight - window.innerHeight;
    if (window.scrollY >= bottom - 200 && nextPage !== null && !isLoading) {
        loadAttractions('');
    }
});
