import smtplib
from email.mime.text import MIMEText

# Replace with your app password
EMAIL_ADDRESS = "chyeyantong03@gmail.com"
EMAIL_PASSWORD = "fgwblqwakfdrvpkk"

msg = MIMEText("This is a test email from your Supabase SMTP config.")
msg["Subject"] = "Test Email"
msg["From"] = EMAIL_ADDRESS
msg["To"] = "chyeyantong03@gmail.com"

try:
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        smtp.send_message(msg)
        print("Test email sent!")
except Exception as e:
    print("Email failed:", e)
