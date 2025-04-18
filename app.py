import os
import json
import logging
import pymysql
import jwt
import bcrypt  # 引入 bcrypt 用於加密密碼
from fastapi import FastAPI, Request, Query, HTTPException
import requests
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from pydantic import BaseModel
from jwt.exceptions import PyJWTError
from datetime import timedelta, datetime
import random

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

# ------------------ Static Pages (Never Modify Code in this Block) ------------------
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
# -------------------------------------------------------------------------------------

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
                record['images'] = json.loads(record['images'])  # 轉換為 JSON 格式

        # 回傳資料，包含是否有下一頁
        return {"nextPage": nextPage, "data": records}
    
    except Exception as e:
        # 如果有錯誤，拋出 500 錯誤
        return JSONResponse(status_code=500, content={
            "error": True,
            "message": "請按照情境提供對應的錯誤訊息"
        })
    
    finally:
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
            attraction['images'] = json.loads(attraction['images'])  # 轉換為 JSON 格式

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


# --------------------- 使用者相關 API ---------------------
# 讀取 JWT 環境變數
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM")

# 定義 User 資料結構（可使用 Pydantic）
class User(BaseModel):
    name: str | None = None
    email: str
    password: str

@app.post("/api/user")
def user_signup(user: User):
    """使用者註冊"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # 檢查 Email 是否已存在
            cursor.execute("SELECT * FROM users WHERE email = %s", (user.email,))
            if cursor.fetchone():
                return JSONResponse(status_code=400, content={"error": True, "message": "Email 已重複註冊"})

            # 密碼加密
            hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            # 插入新使用者
            cursor.execute("INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)",
            (user.name, user.email, hashed_password))
            connection.commit()
        return {"ok": True}
    except Exception as e:
        logging.error("註冊時發生錯誤：%s", e)
        return JSONResponse(status_code=500, content={"error": True, "message": "伺服器內部錯誤"})
    finally:
        connection.close()

@app.put("/api/user/auth")
def user_signin(user: User):
    """使用者登入"""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # 查找使用者
            cursor.execute("SELECT * FROM users WHERE email = %s", (user.email,))
            result = cursor.fetchone()
            if not result:
                return JSONResponse(status_code=400, content={"error": True, "message": "帳號或密碼錯誤"})

            # 密碼驗證
            if not bcrypt.checkpw(user.password.encode('utf-8'), result['password_hash'].encode('utf-8')):
                return JSONResponse(status_code=400, content={"error": True, "message": "帳號或密碼錯誤"})

            # 產生 JWT Token
            payload = {
                "id": result["id"],
                "name": result["name"],
                "email": result["email"],
                "exp": datetime.utcnow() + timedelta(days=7)  # 設定 Token 過期時間
            }
            token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
            return {"token": token}

    except Exception as e:
        logging.error("登入時發生錯誤：%s", e)
        return JSONResponse(status_code=500, content={"error": True, "message": "伺服器內部錯誤"})
    finally:
        connection.close()

@app.get("/api/user/auth")
def get_current_user(request: Request):
    """取得目前登入使用者資訊"""
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return {"data": None}

    token = auth.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"data": payload}
    except PyJWTError:
        return JSONResponse(status_code=400, content={"error": True, "message": "Token 驗證失敗"})

# --------------------- Booking API (新增的部分) ---------------------

# 定義 Booking 輸入資料結構
class BookingModel(BaseModel):
    attractionId: int
    date: str   # 預定日期 (格式例如 "2022-01-31")
    time: str   # 預定時段 ("morning" 或 "afternoon")
    price: int

def verify_token(request: Request):
    """共用的驗證 JWT 的方法，回傳 payload or None"""
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    token = auth.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except PyJWTError:
        return None

@app.get("/api/booking")
def get_booking(request: Request):
    """取得尚未確認下單的預定行程"""
    payload = verify_token(request)
    if not payload:
        return JSONResponse(status_code=403, content={
            "error": True,
            "message": "未登入系統，拒絕存取"
        })
    
    user_id = payload["id"]
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # 取得使用者名稱
            sql_user = "SELECT name FROM users WHERE id = %s"
            cursor.execute(sql_user, (user_id,))
            user = cursor.fetchone()
            user_name = user["name"] if user else "使用者"

            # 查詢使用者的預定行程
            sql = "SELECT * FROM bookings WHERE user_id = %s LIMIT 1"
            cursor.execute(sql, (user_id,))
            booking = cursor.fetchone()
            if not booking:
                return {"data": None}
            
            # 取得景點資訊
            sql_attraction = "SELECT id, name, address, images FROM attractions WHERE id = %s"
            cursor.execute(sql_attraction, (booking["attraction_id"],))
            attraction = cursor.fetchone()
            if attraction:
                images = json.loads(attraction["images"])
                image = images[0] if isinstance(images, list) and len(images) > 0 else ""
                attraction["image"] = image

            booking_data = {
                "userName": user_name, 
                "attraction": attraction,
                "date": booking["date"].strftime("%Y-%m-%d") if isinstance(booking["date"], (datetime,)) else str(booking["date"]),
                "time": booking["time"],
                "price": booking["price"]
            }
        return {"data": booking_data}
    except Exception as e:
        logging.error("取得預定行程時發生錯誤：%s", e)
        return JSONResponse(status_code=500, content={
            "error": True,
            "message": "伺服器內部錯誤"
        })
    finally:
        connection.close()


@app.post("/api/booking")
def create_booking(booking: BookingModel, request: Request):
    """建立新的預定行程"""
    payload = verify_token(request)
    if not payload:
        return JSONResponse(status_code=403, content={
            "error": True,
            "message": "未登入系統，拒絕存取"
        })
    user_id = payload["id"]
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # 檢查該使用者是否已有預定資料，如果有則更新，否則插入新資料
            check_sql = "SELECT * FROM bookings WHERE user_id = %s LIMIT 1"
            cursor.execute(check_sql, (user_id,))
            existing = cursor.fetchone()
            if existing:
                update_sql = """
                    UPDATE bookings
                    SET attraction_id = %s, date = %s, time = %s, price = %s
                    WHERE user_id = %s
                """
                cursor.execute(update_sql, (booking.attractionId, booking.date, booking.time, booking.price, user_id))
            else:
                insert_sql = """
                    INSERT INTO bookings (user_id, attraction_id, date, time, price)
                    VALUES (%s, %s, %s, %s, %s)
                """
                cursor.execute(insert_sql, (user_id, booking.attractionId, booking.date, booking.time, booking.price))
            connection.commit()
        return {"ok": True}
    except Exception as e:
        logging.error("建立預定行程時發生錯誤：%s", e)
        return JSONResponse(status_code=400, content={
            "error": True,
            "message": "請依照情境提供對應的錯誤訊息"
        })
    finally:
        connection.close()

@app.delete("/api/booking")
def delete_booking(request: Request):
    """刪除目前的預定行程"""
    payload = verify_token(request)
    if not payload:
        return JSONResponse(status_code=403, content={
            "error": True,
            "message": "請依照情境提供對應的錯誤訊息"
        })
    user_id = payload["id"]
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            delete_sql = "DELETE FROM bookings WHERE user_id = %s"
            cursor.execute(delete_sql, (user_id,))
            connection.commit()
        return {"ok": True}
    except Exception as e:
        logging.error("刪除預定行程發生錯誤：%s", e)
        return JSONResponse(status_code=500, content={
            "error": True,
            "message": "伺服器內部錯誤"
        })
    finally:
        connection.close()


# TapPay 設定 (請於 .env 中設定)
TAPPAY_PARTNER_KEY = os.getenv("TAPPAY_PARTNER_KEY")
TAPPAY_MERCHANT_ID = os.getenv("TAPPAY_MERCHANT_ID")
TAPPAY_ENDPOINT = "https://sandbox.tappaysdk.com/tpc/payment/pay-by-prime"

# 檢查是否讀取成功
if not TAPPAY_PARTNER_KEY or not TAPPAY_MERCHANT_ID:
    logging.error("❌ 無法讀取 TapPay 設定，請確認 .env 是否正確")
    raise RuntimeError("Missing TapPay credentials in .env")

# Helper: 產生訂單編號 (YYYYMMDDHHmmss + 隨機三位數)
def generate_order_number() -> str:
    now = datetime.now()
    timestamp = now.strftime("%Y%m%d%H%M%S")
    random_suffix = str(random.randint(100, 999))
    return f"{timestamp}{random_suffix}"

class OrderContact(BaseModel):
    name: str
    email: str
    phone: str

class AttractionInfo(BaseModel):
    id: int
    name: str
    address: str
    image: str

class TripInfo(BaseModel):
    attraction: AttractionInfo
    date: str
    time: str

class OrderData(BaseModel):
    price: int
    trip: TripInfo
    contact: OrderContact

class OrderRequest(BaseModel):
    prime: str
    order: OrderData

@app.post("/api/orders")
def create_order(request: Request, body: OrderRequest):
    # 1. 驗證 JWT
    payload = verify_token(request)
    if not payload:
        raise HTTPException(status_code=403, detail="未登入系統，拒絕存取")
    user_id = payload["id"]

    # 2. 產生訂單編號
    order_number = generate_order_number()

    # 3. 建立 TapPay 請求 payload
    tappay_payload = {
        "prime":        body.prime,
        "partner_key":  TAPPAY_PARTNER_KEY,
        "merchant_id":  TAPPAY_MERCHANT_ID,
        "amount":       body.order.price,
        "order_number": order_number,
        "details":      f"台北一日遊：{body.order.trip.attraction.name}",
        "cardholder": {
            "phone_number": body.order.contact.phone,
            "name":         body.order.contact.name,
            "email":        body.order.contact.email
        },
        "remember": True
    }

    headers = {
        "Content-Type": "application/json",
        "x-api-key": TAPPAY_PARTNER_KEY
    }

    # 4. 發送 TapPay 請求
    try:
        resp = requests.post(TAPPAY_ENDPOINT, headers=headers, json=tappay_payload)
        logging.info("TapPay HTTP Status Code: %s", resp.status_code)
        logging.info("TapPay Response Body: %s", resp.text)
        pay_result = resp.json()
    except Exception as e:
        logging.error("TapPay 呼叫失敗：%s", e)
        raise HTTPException(status_code=500, detail="伺服器內部錯誤")

    # 5. 處理回傳
    status = 0 if pay_result.get("status") == 0 else 1
    message = pay_result.get("msg") or ("付款成功" if status == 0 else "付款失敗")

    # 6. 儲存訂單並刪除 booking（同一 transaction）
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 6.1 Insert into orders
            insert_sql = """
                INSERT INTO orders
                (order_number, user_id, price, attraction_id, date, time,
                 contact_name, contact_email, contact_phone, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(insert_sql, (
                order_number,
                user_id,
                body.order.price,
                body.order.trip.attraction.id,
                body.order.trip.date,
                body.order.trip.time,
                body.order.contact.name,
                body.order.contact.email,
                body.order.contact.phone,
                status
            ))

            # 6.2 刪除該使用者的預定行程
            delete_sql = "DELETE FROM bookings WHERE user_id = %s"
            cursor.execute(delete_sql, (user_id,))

        # 一次 commit，確保 insert & delete 同步成功
        conn.commit()
    except Exception as e:
        logging.error("儲存訂單或刪除預定資料失敗：%s", e)
        raise HTTPException(status_code=500, detail="伺服器內部錯誤")
    finally:
        conn.close()

    # 7. 回傳結果
    return {
        "data": {
            "number": order_number,
            "payment": {
                "status":  status,
                "message": message
            }
        }
    }


@app.get("/api/order/{orderNumber}")
def get_order(orderNumber: str, request: Request):
    # 驗證 JWT
    payload = verify_token(request)
    if not payload:
        raise HTTPException(status_code=403, detail="未登入系統，拒絕存取")

    conn = get_db_connection()
    try:
        # 直接用一般 cursor()，fetchone() 回傳 dict
        with conn.cursor() as cursor:
            sql = "SELECT * FROM orders WHERE order_number = %s AND user_id = %s"
            cursor.execute(sql, (orderNumber, payload["id"]))
            order = cursor.fetchone()
            if not order:
                return {"data": None}

            # 組裝回傳資料
            trip = {
                "attraction": {
                    "id": order["attraction_id"],
                    "name": "",  # 可再查 attractions 表補全
                    "address": "",
                    "image": ""
                },
                "date": str(order["date"]),
                "time": order["time"]
            }
            contact = {
                "name": order["contact_name"],
                "email": order["contact_email"],
                "phone": order["contact_phone"]
            }

            return {"data": {
                "number": order["order_number"],
                "price": order["price"],
                "trip": trip,
                "contact": contact,
                "status": order["status"]
            }}
    except Exception as e:
        logging.error("取得訂單資訊失敗：%s", e)
        raise HTTPException(status_code=500, detail="伺服器內部錯誤")
    finally:
        conn.close()

