package id.co.awapart66.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.WebResourceError
import android.webkit.WebResourceResponse
import android.widget.ProgressBar
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import android.widget.LinearLayout
import android.widget.TextView
import android.graphics.Color
import android.view.Gravity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowCompat
import android.app.AlertDialog
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {
    private var uploadCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var webView: WebView
    private lateinit var nav: LinearLayout
    private lateinit var header: TextView
    private lateinit var offline: TextView
    private lateinit var progress: ProgressBar
    private val handler = Handler(Looper.getMainLooper())
    private var failed = false
    private val host = "awapart66.com"
    private lateinit var chooser: LinearLayout
    private lateinit var roleBar: LinearLayout
    private var access = ""
    private var shownNav = ""
    private val monitor = object : Runnable {
        override fun run() {
            if (isFinishing || isDestroyed) return
            val current = access
            val uri = Uri.parse(webView.url ?: "")
            val expected = if (current == "customer") "/customer.html" else "/portal.html"
            if (!failed && current.isNotEmpty() && uri.scheme == "https" && uri.host == host && uri.path == expected) {
                val js = if (current == "customer") "!!document.getElementById('customerContent') && !document.getElementById('customerContent').hidden && !document.body.classList.contains('locked')" else "!!document.getElementById('appPanel') && !document.getElementById('appPanel').classList.contains('hidden')"
                webView.evaluateJavascript(js) { result ->
                    if (access == current && !failed && webView.url == uri.toString()) {
                        val visible = result == "true"
                        if (visible) buildNav(current)
                        nav.visibility = if (visible) View.VISIBLE else View.GONE
                        header.visibility = if (visible) View.VISIBLE else View.GONE
                    }
                }
            } else { nav.visibility = View.GONE; header.visibility = View.GONE }
            handler.postDelayed(this, 350)
        }
    }
    private fun buildNav(kind: String) {
        if (shownNav == kind) return
        shownNav = kind
        nav.removeAllViews()
        val labels = when(kind) {
            "admin", "operational", "super" -> listOf("Dasbor", "Unit", "Reservasi", "Keuangan", "Lainnya")
            "owner" -> listOf("Ringkasan", "Unit", "Pendapatan", "Booking", "Akun")
            else -> listOf("Beranda", "Cari unit", "Booking", "Akun")
        }
        labels.forEachIndexed { i, label ->
            val tab = TextView(this).apply {
                text = label; textSize = 12f; gravity = Gravity.CENTER; setTextColor(gold)
                setOnClickListener {
                    when(kind) {
                        "admin", "operational", "super" -> when(i) {
                            0 -> jump("pageTitle")
                            1 -> portalTab("units")
                            2 -> portalTab("bookings")
                            3 -> portalTab("finance")
                            else -> jump("adminArea")
                        }
                        "owner" -> when(i) {
                            0 -> jump("pageTitle")
                            1 -> jump("myUnits")
                            2 -> jump("ofSummary")
                            3 -> webView.evaluateJavascript("document.querySelector('#ownerArea section:last-child')?.scrollIntoView()", null)
                            else -> accountMenu()
                        }
                        else -> when(i) {
                            0 -> webView.evaluateJavascript("window.scrollTo(0,0)", null)
                            1 -> jump("katalog")
                            2 -> jump("accountDashboard")
                            else -> accountMenu()
                        }
                    }
                }
            }
            nav.addView(tab, LinearLayout.LayoutParams(0,dp(58),1f))
        }
    }
    private fun portalTab(tab: String) {
        val selector = org.json.JSONObject.quote("[data-tab='$tab']")
        webView.evaluateJavascript("document.querySelector($selector)?.click();document.getElementById('tab-$tab')?.scrollIntoView()", null)
    }
    private fun accountMenu() {
        AlertDialog.Builder(this).setTitle("Akun AWAPART 66").setItems(arrayOf("Ganti akses / keluar", "Informasi & bantuan", "Batal")) { _, i -> if(i == 0) showChooser() else if(i == 1) showInfo() }.show()
    }
    private fun showInfo() {
        AlertDialog.Builder(this).setTitle("AWAPART 66 • 2.5.9")
            .setMessage("PT AWAPART SUKSES BERSAMA\nBantuan akun dan pemulihan password: awapartsukses@gmail.com\nJangan bagikan password atau OTP.\nKeluar menghapus sesi lokal perangkat; pencabutan token server belum tersedia.")
            .setPositiveButton("Tutup", null).show()
    }
    private fun showChooser() {
        access = ""; shownNav = ""; failed = false
        webView.stopLoading()
        webView.loadUrl("about:blank")
        webView.clearHistory()
        webView.clearCache(true)
        webView.clearFormData()
        android.webkit.WebStorage.getInstance().deleteAllData()
        android.webkit.CookieManager.getInstance().removeAllCookies(null)
        android.webkit.CookieManager.getInstance().flush()
        webView.visibility = View.GONE; nav.visibility = View.GONE; header.visibility = View.GONE
        progress.visibility = View.GONE; offline.visibility = View.GONE; roleBar.visibility = View.GONE
        chooser.visibility = View.VISIBLE
    }
    private fun openAccess(kind: String) {
        access = kind; shownNav = ""; chooser.visibility = View.GONE
        webView.visibility = View.VISIBLE; roleBar.visibility = View.VISIBLE
        webView.loadUrl(if(kind == "customer") appUrl else "https://awapart66.com/portal.html?v=264&access=$kind")
    }
    private var pendingSection: String? = null
    private val navy = Color.rgb(16,29,53)
    private val gold = Color.rgb(198,154,66)
    private fun dp(n: Int) = (n * resources.displayMetrics.density + 0.5f).toInt()
    private fun section(label: String) {
        if (webView.url?.contains("/portal.html") == true) {
            pendingSection = label
            webView.loadUrl(appUrl)
        } else activateSection(label)
    }
    private fun activateSection(label: String) {
        val quoted = org.json.JSONObject.quote(label)
        webView.evaluateJavascript("""(function(){const label=$quoted; const els=Array.from(document.querySelectorAll('a,button'));const el=els.find(e=>e.getClientRects().length && e.textContent.trim().toLowerCase()===label.toLowerCase());if(el){el.click();return true;}return false;})()""") { result ->
            if(result != "true") Toast.makeText(this, "Gunakan menu $label pada halaman customer.", Toast.LENGTH_SHORT).show()
        }
    }
    private val uploadRequest = 6102
    private val appUrl = "https://awapart66.com/customer.html?v=264"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.settings.allowFileAccessFromFileURLs = false
        webView.settings.allowUniversalAccessFromFileURLs = false
        webView.settings.setSupportMultipleWindows(false)
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)
        if (android.os.Build.VERSION.SDK_INT >= 26) webView.settings.safeBrowsingEnabled = true
        WebView.setWebContentsDebuggingEnabled(false)
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (Uri.parse(url).host != host || failed) return
                progress.visibility = View.GONE
                if (access == "admin" || access == "operational" || access == "super" || access == "owner") {
                    val chosen = org.json.JSONObject.quote(if(access == "owner") "owner" else "admin")
                    view.evaluateJavascript("""(function(){const r=document.getElementById('role');if(r){r.value=$chosen;r.disabled=true;}const h=document.querySelector('#loginPanel h2');if(h)h.textContent=$chosen==='admin'?'Masuk Admin':'Masuk Pemilik Properti';})()""", null)
                }
                if (!Uri.parse(url).path.orEmpty().contains("portal.html")) {
                    view.evaluateJavascript("""(function(){if(document.getElementById('aw241-style'))return;const s=document.createElement('style');s.id='aw241-style';s.textContent='@media(max-width:720px){body{overflow-x:hidden}img{max-width:100%} .hero h1{font-size:clamp(24px,6vw,32px)!important;line-height:1.15!important} .hero{min-height:0!important;padding:20px!important} .hero p{font-size:15px!important;line-height:1.5!important} input,select,textarea{max-width:100%;box-sizing:border-box}}';document.head.appendChild(s);})();""", null)
                    pendingSection?.let { pendingSection = null; activateSection(it) }
                }
            }
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                if (access.isEmpty()) return
                failed = false
                nav.visibility = View.GONE
                header.visibility = View.GONE
                offline.visibility = View.GONE
                progress.visibility = View.VISIBLE
            }
            override fun onReceivedSslError(view: WebView, handler: android.webkit.SslErrorHandler, error: android.net.http.SslError) {
                handler.cancel()
                showOffline()
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showOffline()
            }
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
                if (request.isForMainFrame && errorResponse.statusCode >= 500) showOffline()
            }
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                return if (uri.scheme == "https" && uri.host == host) {
                    val expected = if (access == "customer") "/customer.html" else "/portal.html"
                    if (request.isForMainFrame && uri.path != expected) { Toast.makeText(this@MainActivity, "Gunakan pilihan akses.", Toast.LENGTH_SHORT).show(); true } else false
                } else {
                    if (!request.isForMainFrame || !request.hasGesture()) return true
                    Toast.makeText(this@MainActivity, "Tautan eksternal dibuka melalui browser.", Toast.LENGTH_SHORT).show()
                    val intent = Intent(Intent.ACTION_VIEW, uri)
                    if (uri.scheme == "https") {
                        try { startActivity(intent) } catch (_: android.content.ActivityNotFoundException) {}
                    }
                    true
                }
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                uploadCallback?.onReceiveValue(null)
                uploadCallback = filePathCallback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/jpeg", "image/png", "image/webp", "application/pdf"))
                }
                try { startActivityForResult(intent, uploadRequest) } catch (_: android.content.ActivityNotFoundException) {
                    uploadCallback?.onReceiveValue(null)
                    uploadCallback = null
                }
                return true
            }
        }
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(navy)
        }
        ViewCompat.setOnApplyWindowInsetsListener(layout) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        header = TextView(this).apply {
            text = "AWAPART 66  •  APARTMENT RENTAL"
            setTextColor(gold)
            textSize = 13f
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16),0,dp(16),0)
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(header, LinearLayout.LayoutParams(-1,dp(44)))
        header.visibility = View.GONE
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { isIndeterminate = true }
        layout.addView(progress, LinearLayout.LayoutParams(-1,dp(3)))
        offline = TextView(this).apply {
            text = "Koneksi bermasalah. Ketuk untuk mencoba lagi."
            setTextColor(gold); gravity = Gravity.CENTER; setPadding(dp(20),dp(24),dp(20),dp(24))
            visibility = View.GONE
            setOnClickListener { if (access.isNotEmpty()) openAccess(access) }
        }
        layout.addView(offline)
        roleBar = LinearLayout(this).apply {
            addView(TextView(this@MainActivity).apply {
                text = "‹  Pilihan akses"; setTextColor(gold); textSize = 15f
                setPadding(dp(16),dp(12),dp(16),dp(12)); setOnClickListener { accountMenu() }
            })
        }
        layout.addView(roleBar)
        chooser = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
            setPadding(dp(22),dp(12),dp(22),dp(12))
            fun line(value: String, size: Float, color: Int) = TextView(this@MainActivity).apply {
                text = value; textSize = size; setTextColor(color); gravity = Gravity.CENTER
                setPadding(0,dp(8),0,dp(8))
            }
            addView(line("A66",36f,gold)); addView(line("AWAPART 66",24f,Color.WHITE))
            addView(line("PT AWAPART SUKSES BERSAMA",12f,gold))
            addView(line("Pilih akses Anda",18f,Color.WHITE))
            listOf(Triple("Customer","Cari unit dan reservasi","customer"),Triple("Pemilik Properti","Unit dan pendapatan","owner"),Triple("Admin Operasional","Operasional sesuai izin","operational"),Triple("Super Admin","Pusat kendali perusahaan","super")).forEach { (title,desc,kind) ->
                val card = line("$title  ›\n$desc",16f,Color.WHITE).apply {
                    background = android.graphics.drawable.GradientDrawable().apply { setColor(Color.rgb(36,52,77)); cornerRadius = dp(14).toFloat(); setStroke(dp(1),gold) }
                    setPadding(dp(12),dp(15),dp(12),dp(15)); setOnClickListener { openAccess(kind) }
                }
                addView(card,LinearLayout.LayoutParams(-1,-2).apply { bottomMargin=dp(10) })
            }
        }
        chooser.addView(TextView(this).apply { text = "Informasi & bantuan • v2.5.9"; setTextColor(gold); gravity = Gravity.CENTER; setPadding(0,dp(12),0,dp(12)); setOnClickListener { showInfo() } })
        layout.addView(chooser,LinearLayout.LayoutParams(-1,0,1f))
        layout.addView(webView, LinearLayout.LayoutParams(-1,0,1f))
        nav = LinearLayout(this).apply { setBackgroundColor(navy) }
        nav.visibility = View.GONE
        layout.addView(nav)
        setContentView(layout)
        ViewCompat.requestApplyInsets(layout)
        showChooser()
        handler.post(monitor)
    }

    private fun jump(id: String) {
        val quoted = org.json.JSONObject.quote(id)
        webView.evaluateJavascript("document.getElementById($quoted)?.scrollIntoView({behavior:'smooth'})", null)
    }
    private fun showOffline() {
        failed = true
        nav.visibility = View.GONE
        header.visibility = View.GONE
        progress.visibility = View.GONE
        offline.visibility = View.VISIBLE
    }
    override fun onDestroy() {
        handler.removeCallbacks(monitor)
        uploadCallback?.onReceiveValue(null)
        uploadCallback = null
        webView.destroy()
        super.onDestroy()
    }
    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Deprecated by Android; retained for WebView file chooser compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == uploadRequest) {
            val result = if (resultCode == RESULT_OK) data?.data?.let { arrayOf(it) } else null
            uploadCallback?.onReceiveValue(result)
            uploadCallback = null
        }
    }

    @Deprecated("Use Android back dispatcher in a future update")
    override fun onBackPressed() {
        if (access.isNotEmpty()) accountMenu() else super.onBackPressed()
    }
}
