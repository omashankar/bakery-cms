# Dukaan live karna — checklist

Har step ke baad `npm run check` chalao. Jab usme **0 blocking** dikhe, dukaan
asli customers ke liye taiyaar hai.

`aapka-domain.in` ki jagah apna domain likhna.

---

## 1. Hosting chuno (pehle ye)

| | VPS / ek server (Hostinger VPS, DigitalOcean, AWS EC2) | Vercel |
|---|---|---|
| Deploy | thoda setup (Node + nginx) | sabse aasaan |
| Login-spam limit | sahi kaam karti hai | har instance alag ginti — kamzor |
| Is app ke liye | **sujhav** | limit ko database par le jaana padega (extra kaam) |

VPS par nginx ke peeche chalao aur `TRUST_PROXY_HEADERS=true` set karo.
**Bina reverse proxy ke ye `true` mat karna.**

## 2. Production database (alag)

- MongoDB Atlas mein **naya** database banao — development wala nahi.
- Atlas → Network Access mein server ka IP add karo.
- Server par `MONGODB_URI` mein naya database.

## 3. Secret keys (naye)

Server par teen **alag-alag** values (har ek ke liye `openssl rand -base64 32`):

```
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_CUSTOMER_SECRET=...
```

## 4. Razorpay live

Poore steps: [payments-live-test.md](./payments-live-test.md) — wahi steps,
bas **Live** mode mein.

- Server par `RAZORPAY_KEY_ID=rzp_live_...` aur `RAZORPAY_KEY_SECRET=...`
  (secret kisi ko chat/email mein mat bhejna).
- Razorpay → Settings → Webhooks → Add (Live mode mein **alag** se):
  - URL: `https://aapka-domain.in/api/razorpay/webhook`
  - Events: `payment.captured`, `order.paid`, `refund.processed`, `refund.failed`
  - Jo secret banao, wahi server par `RAZORPAY_WEBHOOK_SECRET`.
- Pehla order ₹1 jaisa chhota karke test karo, phir refund.

## 5. Website ka address

```
NEXT_PUBLIC_SITE_URL=https://aapka-domain.in
```

Iske bina invoice aur email ke links kahin nahi jaate.

## 6. Email apne domain se

Admin → Settings → SMTP:
- From address `orders@aapka-domain.in` jaisa (abhi `zend-apps.com` se jaata hai).
- Domain ke DNS mein email provider ka **SPF** aur **DKIM** record lagao,
  warna mail spam mein jaayegi.

## 7. Photos (Cloudinary)

Abhi configured hai. Server par bhi wahi `CLOUDINARY_*` values **build se
pehle** set honi chahiye, warna upload ki hui photos khaali dikhengi.

## 8. Pehla owner (sirf naye database par)

```
ADMIN_EMAIL=owner@aapka-domain.in
ADMIN_PASSWORD=kam-se-kam-10-akshar
npm run seed
```

## 9. Build aur check

```
npm run build
npm run start
npm run check     # 0 blocking hona chahiye
```
