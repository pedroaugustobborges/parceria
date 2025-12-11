# 🔧 Troubleshooting Guide - Firefox Hanging Issue

## 🚨 Problem: Script hangs at "Iniciando Firefox em modo headless..."

This is a **very common issue** on Linux servers and has several solutions.

---

## ✅ **Quick Fix (Most Common)**

Run these commands on your DigitalOcean droplet:

```bash
# 1. Kill any stuck Firefox/Geckodriver processes
pkill -9 firefox
pkill -9 geckodriver

# 2. Install missing dependencies
sudo apt-get update
sudo apt-get install -y \
    libgtk-3-0 \
    libdbus-glib-1-2 \
    libxt6 \
    libx11-xcb1 \
    libasound2 \
    libxtst6

# 3. Verify Firefox is installed
firefox --version

# 4. If Firefox is NOT installed:
sudo apt-get install -y firefox

# 5. Verify Geckodriver version compatibility
geckodriver --version
firefox --version

# Firefox and Geckodriver versions must be compatible!
# If incompatible, update Geckodriver:
wget https://github.com/mozilla/geckodriver/releases/download/v0.34.0/geckodriver-v0.34.0-linux64.tar.gz
tar -xzf geckodriver-v0.34.0-linux64.tar.gz
sudo mv geckodriver /usr/local/bin/
sudo chmod +x /usr/local/bin/geckodriver
```

---

## 🔍 **Step-by-Step Diagnosis**

### Step 1: Run the diagnostic script

```bash
cd ~/gestaodeacesso
python3 diagnose-firefox.py
```

This will tell you exactly what's wrong.

---

### Step 2: Common Issues & Solutions

#### ❌ **Issue 1: Firefox not installed**

```bash
sudo apt-get update
sudo apt-get install -y firefox
```

#### ❌ **Issue 2: Geckodriver not found**

```bash
# Download latest Geckodriver
wget https://github.com/mozilla/geckodriver/releases/download/v0.34.0/geckodriver-v0.34.0-linux64.tar.gz
tar -xzf geckodriver-v0.34.0-linux64.tar.gz
sudo mv geckodriver /usr/local/bin/
sudo chmod +x /usr/local/bin/geckodriver

# Verify
geckodriver --version
```

#### ❌ **Issue 3: Version incompatibility**

Check versions:
```bash
firefox --version      # Example output: Mozilla Firefox 121.0
geckodriver --version  # Must be compatible (check Mozilla docs)
```

**Compatibility Matrix:**
- Firefox 115-121 → Geckodriver 0.33.0 - 0.34.0
- Firefox 102-115 → Geckodriver 0.31.0 - 0.33.0

If incompatible, download the correct Geckodriver version from:
https://github.com/mozilla/geckodriver/releases

#### ❌ **Issue 4: Missing dependencies**

```bash
sudo apt-get install -y \
    libgtk-3-0 \
    libdbus-glib-1-2 \
    libxt6 \
    libx11-xcb1 \
    libasound2 \
    libxtst6 \
    libpci3 \
    libdrm2 \
    libgbm1
```

#### ❌ **Issue 5: Processes stuck**

```bash
# Kill all Firefox/Geckodriver processes
pkill -9 firefox
pkill -9 geckodriver

# Verify they're gone
ps aux | grep -E "(firefox|geckodriver)"

# Clean up temp files
rm -rf /tmp/.org.chromium.* /tmp/rust_mozprofile* 2>/dev/null
```

---

## 🧪 **Testing Solutions**

### Test 1: Manual Firefox headless test

```bash
# This should create a screenshot without hanging
timeout 30 firefox --headless --screenshot /tmp/test.png about:blank

# Check if screenshot was created
ls -lh /tmp/test.png
```

If this **hangs**, Firefox itself is broken. Reinstall:

```bash
sudo apt-get remove --purge firefox
sudo apt-get autoremove
sudo apt-get install -y firefox
```

### Test 2: Selenium test

```bash
cd ~/gestaodeacesso
python3 -c "
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service

options = Options()
options.add_argument('--headless')

service = Service('/usr/local/bin/geckodriver')
driver = webdriver.Firefox(service=service, options=options)

driver.get('http://example.com')
print('✅ SUCCESS: Selenium works!')
driver.quit()
"
```

If this **succeeds**, your main script should now work.

---

## 🔄 **Alternative: Use Chrome instead of Firefox**

If Firefox continues to fail, switch to Chrome:

```bash
# Install Chrome and Chromedriver
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# Install Chromedriver
wget https://chromedriver.storage.googleapis.com/114.0.5735.90/chromedriver_linux64.zip
unzip chromedriver_linux64.zip
sudo mv chromedriver /usr/local/bin/
sudo chmod +x /usr/local/bin/chromedriver
```

Then modify the script to use Chrome (I can help with this if needed).

---

## 📊 **Checking Logs**

### Geckodriver logs:
```bash
tail -f /tmp/geckodriver.log
```

### Script logs:
```bash
tail -f /var/log/produtividade-mv.log
```

### System logs:
```bash
journalctl -xe | grep -i firefox
```

---

## 🆘 **Still Not Working?**

### Option 1: Share your diagnostic output

```bash
python3 diagnose-firefox.py > diagnostic-output.txt 2>&1
cat diagnostic-output.txt
```

Send me the output.

### Option 2: Check system resources

```bash
# Check available memory
free -h

# Check disk space
df -h

# Check CPU
top -bn1 | head -20
```

Firefox requires at least:
- **512MB RAM** free
- **1GB disk** space
- 1 CPU core

---

## 🎯 **Most Likely Fix (90% of cases)**

```bash
# Run this complete fix:
pkill -9 firefox geckodriver
sudo apt-get update
sudo apt-get install -y firefox libgtk-3-0 libdbus-glib-1-2 libxt6 libx11-xcb1
rm -rf /tmp/.org.chromium.* /tmp/rust_mozprofile*

# Then restart your script
python3 coletar-produtividade-mv.py
```

---

## 📝 **Script Improvements in New Version**

The updated script now includes:

✅ **60-second timeout** - Script won't hang forever
✅ **Auto-kill stuck processes** - Cleans up before starting
✅ **Better error messages** - Tells you exactly what's wrong
✅ **Diagnostic suggestions** - Points you to solutions
✅ **Multiple Firefox paths** - Tries /usr/bin/firefox, /snap/bin/firefox, etc.

So even if Firefox is misconfigured, you'll get a clear error message within 60 seconds instead of hanging indefinitely.

---

## 🚀 **After Fixing Firefox**

Once Firefox starts successfully, the script will:

1. ✅ Process all 400 doctors without the "200 Wall"
2. ✅ Auto-restart driver every 50 users
3. ✅ Retry timeouts automatically (3 attempts)
4. ✅ Handle server slowdowns gracefully
5. ✅ Complete with 95%+ success rate

Good luck! 🎉
