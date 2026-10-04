# راه‌اندازی حساب کاربری، همگام‌سازی و پرداخت واقعی

تا وقتی `src/config.ts` خالی است، اپ مثل قبل کاملاً روی دستگاه کار می‌کند و پرداخت شبیه‌سازی است. برای فعال کردن نسخه‌ی واقعی:

## ۱. ساخت پروژه‌ی Supabase
1. در supabase.com ثبت‌نام کن و یک پروژه بساز.
2. در **SQL Editor** محتوای `schema.sql` را اجرا کن.
3. در **Authentication → Providers → Email**، ورود با ایمیل را روشن بگذار.
4. در **Authentication → Email Templates → Magic Link**، متن ایمیل را طوری بنویس که کد را نشان بدهد، مثلاً:
   `کد ورود شما به فیتورا: {{ .Token }}`
5. برای ارسال ایمیل در محیط واقعی، در **Authentication → SMTP** یک سرویس ایمیل (مثل Resend یا Brevo) وصل کن؛ سرویس پیش‌فرض Supabase محدودیت ارسال دارد.

## ۲. وصل کردن اپ
در `src/config.ts` آدرس پروژه و **anon key** را از **Project Settings → API** بگذار.

## ۳. پرداخت با زرین‌پال
1. در زرین‌پال پذیرنده شو و **مرچنت کد** ۳۶ کاراکتری بگیر. دامنه‌ی سایتت باید در پنل زرین‌پال ثبت شود.
2. Supabase CLI را نصب کن و فانکشن‌ها را منتشر کن:
   ```bash
   supabase login
   supabase link --project-ref <PROJECT_REF>
   supabase secrets set ZARINPAL_MERCHANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   supabase secrets set APP_URLS=https://your-domain.com/
   supabase secrets set ZARINPAL_SANDBOX=true   # برای تست؛ در محیط واقعی حذفش کن
   supabase functions deploy checkout
   supabase functions deploy verify --no-verify-jwt
   ```
3. قیمت‌ها را در `functions/_shared/plans.ts` (مبلغ واقعی) و `src/payments.ts` (فقط نمایش) هم‌زمان تغییر بده.

## ۳-ب. پرداخت با کارت اعتباری / ویزا / مسترکارت (iyzico)
برای کاربران ترکیه و خارج از ایران. کاربر به صفحه‌ی پرداخت خود iyzico می‌رود و با کارت اعتباری یا بانکی (Visa، Mastercard، Troy) و 3-D Secure پرداخت می‌کند. اطلاعات کارت هیچ‌وقت به اپ نمی‌رسد.
1. در iyzico.com حساب پذیرنده (کسب‌وکار ثبت‌شده در ترکیه) بگیر. برای تست، در sandbox-merchant.iyzipay.com یک حساب آزمایشی رایگان بساز.
2. از پنل، **API Key** و **Secret Key** را بردار.
3. ```bash
   supabase secrets set IYZICO_API_KEY=... IYZICO_SECRET_KEY=...
   supabase secrets set IYZICO_SANDBOX=true   # برای تست؛ در محیط واقعی حذفش کن و کلیدهای اصلی بگذار
   supabase functions deploy checkout
   supabase functions deploy verify --no-verify-jwt
   ```
4. اگر پایگاه داده را قبل از این تغییر ساخته‌ای، چهار خط `alter table` انتهای `schema.sql` را یک بار اجرا کن.
5. در `src/config.ts`، `PAY_PROVIDER` تعیین می‌کند هر زبان به کدام درگاه برود (پیش‌فرض: فارسی → زرین‌پال با تومان، ترکی → iyzico با لیر، انگلیسی → iyzico با دلار). قیمت‌ها در `plans.ts` (`tryKurus`، `usdCents`) و `src/payments.ts` (`try`، `usd`) هستند.
6. iyzico نام، نشانی و شماره‌ی ملی خریدار را می‌خواهد و اپ این‌ها را از کاربر نمی‌گیرد؛ فعلاً مقدارهای خنثی فرستاده می‌شود (`_shared/iyzico.ts`). قبل از محیط واقعی با iyzico هماهنگ کن که برای اشتراک دیجیتال همین کافی است، وگرنه باید این اطلاعات از کاربر گرفته شود.

پی‌پال هم به‌عنوان درگاه سوم آماده است (`PAYPAL_CLIENT_ID`، `PAYPAL_SECRET`، `PAYPAL_SANDBOX` و مقدار `'paypal'` در `PAY_PROVIDER`)، ولی پی‌پال در ایران و ترکیه حساب پذیرنده نمی‌دهد.

## ۴. راهنمای صوتی فارسی (اختیاری ولی توصیه‌شده)
خیلی از گوشی‌ها، به‌خصوص آیفون، صدای فارسی داخلی ندارند. برای صدای فارسی طبیعی:
1. در Azure یک منبع **Speech** بساز (پلن رایگان ماهانه حدود ۵۰۰ هزار کاراکتر دارد) و کلید و region آن را بردار.
2. ```bash
   supabase secrets set AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=westeurope
   supabase functions deploy tts --no-verify-jwt
   ```
   صدای پیش‌فرض `fa-IR-DilaraNeural` (زن) است؛ برای صدای مرد `AZURE_VOICE=fa-IR-FaridNeural` بگذار.
   همین فانکشن صدای ترکی و انگلیسی را هم می‌سازد (`tr-TR-EmelNeural` و `en-US-JennyNeural`؛ با `AZURE_VOICE_TR` و `AZURE_VOICE_EN` قابل تغییر است).
هر جمله فقط یک بار ساخته و روی گوشی کاربر ذخیره می‌شود، پس هزینه خیلی کم است. بدون این مرحله، اپ فقط از صدای خود دستگاه استفاده می‌کند: اگر دستگاه یا مرورگر برای زبان انتخاب‌شده صدا نداشته باشد (مثلاً کروم روی ویندوز برای فارسی و ترکی)، راهنمای صوتی خاموش می‌ماند.

## امنیت
- کلید service role و مرچنت کد فقط در secrets فانکشن‌ها هستند، نه در اپ.
- اشتراک را فقط فانکشن verify، بعد از تأیید خود زرین‌پال، می‌نویسد. کاربر نمی‌تواند با دست‌کاری اپ اشتراک بگیرد.
- مبلغ از سرور خوانده می‌شود، نه از درخواست کاربر.
- دوره‌ی آزمایشی ۷ روزه فعلاً روی دستگاه ثبت می‌شود. اگر سوءاستفاده دیدی، آن را هم به سرور منتقل کن.

## درگاه دیگر
برای ترکیه (iyzico) یا بین‌المللی (Stripe)، فقط `functions/_shared/zarinpal.ts` را با درگاه دیگر جایگزین کن؛ بقیه‌ی جریان همین می‌ماند.
