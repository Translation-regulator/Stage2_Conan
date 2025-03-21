import os
import json
import logging
import pymysql
from fastapi import FastAPI, Request, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

# 設定日誌
logging.basicConfig(level=logging.INFO)

# 資料庫連線設定，建議以環境變數管理敏感資訊
DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")
DB_CHARSET = os.getenv("DB_CHARSET", "utf8mb4")

def get_db_connection():
    try:
        connection = pymysql.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            db=DB_NAME,
            charset=DB_CHARSET,
            cursorclass=pymysql.cursors.DictCursor
        )
        return connection
    except Exception as e:
        logging.error("無法連接資料庫：%s", e)
        raise

app = FastAPI()
# 掛載靜態檔案
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/image", StaticFiles(directory="static/image"), name="image")

# Static Pages (Never Modify Code in this Block)
@app.get("/", include_in_schema=False)
async def index(request: Request):
	return FileResponse("./static/index.html", media_type="text/html")
@app.get("/attraction/{id}", include_in_schema=False)
async def attraction(request: Request, id: int):
	return FileResponse("./static/attraction.html", media_type="text/html")
@app.get("/booking", include_in_schema=False)
async def booking(request: Request):
	return FileResponse("./static/booking.html", media_type="text/html")
@app.get("/thankyou", include_in_schema=False)
async def thankyou(request: Request):
	return FileResponse("./static/thankyou.html", media_type="text/html")

@app.get("/api/attractions")
def get_attractions(page: int = Query(0), keyword: str = Query(None)):
    per_page = 12
    offset = page * per_page
    connection = get_db_connection()
    
    try:
        with connection.cursor() as cursor:
            if keyword:
                # 移除關鍵字兩端的空白
                keyword = keyword.strip()
                # 使用 LIKE 搜尋景點名稱 (name) 和捷運站名稱 (MRT)
                sql = """
                    SELECT a.*, m.mrt FROM attractions a
                    LEFT JOIN attraction_mrt m ON a.attraction_mrt_id = m.id
                    WHERE a.name LIKE %s OR m.mrt LIKE %s 
                    LIMIT %s OFFSET %s
                """
                cursor.execute(sql, ('%' + keyword + '%', '%' + keyword + '%', per_page + 1, offset))
            else:
                # 沒有關鍵字，顯示所有景點
                sql = """
                    SELECT a.*, m.mrt FROM attractions a
                    LEFT JOIN attraction_mrt m ON a.attraction_mrt_id = m.id
                    LIMIT %s OFFSET %s
                """
                cursor.execute(sql, (per_page + 1, offset))
            
            records = cursor.fetchall()
            
            # 如果資料超過每頁數量，表示有下一頁
            if len(records) > per_page:
                nextPage = page + 1
                records = records[:per_page]
            else:
                nextPage = None
            
            # 如果沒有資料，回傳500錯誤
            if not records:
                return JSONResponse(status_code=500, content={
                    "error": True,
                    "message": "所查詢的頁面不存在"
                })
            
            # 轉換圖片欄位為 JSON 格式
            for record in records:
                images = json.loads(record['images'])
                record['image'] = images[0] if images else None  # 只取第一張圖
                del record['images']  # 刪除原本的 images 欄位

        
        # 回傳資料，包含是否有下一頁
        return {"nextPage": nextPage, "data": records}
    
    except Exception as e:
        # 如果有錯誤，拋出 500 錯誤
        return JSONResponse(status_code=500, content={
            "error": True,
            "message": "請按照情境提供對應的錯誤訊息"
        })
    
    finally:
        # 確保關閉連線
        connection.close()


@app.get("/api/attraction/{attractionId}")
def get_attraction_detail(attractionId: int):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            sql = """
                SELECT a.*, m.mrt FROM attractions a
                LEFT JOIN attraction_mrt m ON a.attraction_mrt_id = m.id
                WHERE a.id = %s
            """
            cursor.execute(sql, (attractionId,))
            attraction = cursor.fetchone()
            if not attraction:
                # 回傳 400 錯誤及錯誤訊息
                return JSONResponse(status_code=400, content={
                    "error": True,
                    "message": "對應的景點編號不存在"
                })
            attraction['images'] = json.loads(attraction['images'])
            attraction['image'] = attraction['images'][0] if attraction['images'] else None  # 只取第一張圖
            del attraction['images']  # 刪除原本的 images 欄位

        return {"data": attraction}
    except Exception as e:
        # 伺服器內部錯誤處理
        return JSONResponse(status_code=500, content={
            "error": True,
            "message": "伺服器內部錯誤"
        })
    finally:
        connection.close()

@app.get("/api/mrts")
def get_mrts():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # 根據 mrt 分組並計算每個 mrt 的景點數量，依數量由大到小排序
            sql = """
                SELECT m.mrt, COUNT(*) as count 
                FROM attraction_mrt m
                LEFT JOIN attractions a ON a.attraction_mrt_id = m.id
                GROUP BY m.mrt 
                ORDER BY count DESC
            """
            cursor.execute(sql)
            results = cursor.fetchall()
            # 只回傳 mrt 名稱列表
            mrts = [item['mrt'] for item in results]
        return {"data": mrts}
    except Exception as e:
        # 當發生例外時，回傳符合 API 規格的錯誤訊息
        return JSONResponse(status_code=500, content={"error": True, "message": "伺服器內部錯誤"})
    finally:
        connection.close()

if __name__ == "__main__":
    uvicorn.run("app:app", host="localhost", port=8000, reload=True)
