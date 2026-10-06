define(['jquery', 'core/ajax', 'core/notification'], function($, ajax, notification) {
    return {
        init: function(quizId, attemptId) {
            console.log("Proctoring JS Init with Calibration", quizId, attemptId);
            
            var violationCount = 0;
            var maxTolerance = 3;
            var modalTimer;
            var calibrationTimer;
            
            var calibKey = 'proctoring_calibrated_' + attemptId;
            var isReviewPage = window.location.href.indexOf('review.php') !== -1;
            
            // ==========================================
            // 0. AMBIL NAMA KUIS
            // ==========================================
            var dynamicQuizName = "Ujian Sertifikasi";
            var pageTitleElement = document.querySelector('.page-header-headings h1') || document.querySelector('h1') || document.querySelector('h2');
            
            if (pageTitleElement) {
                dynamicQuizName = pageTitleElement.innerText.trim();
            } else if (document.title) {
                // Jika tag h1 tidak ada, ambil dari tab title browser (potong sebelum tanda | atau -)
                dynamicQuizName = document.title.split('|')[0].split('-')[0].trim();
            }
            
            // ==========================================
            // 1. INJEKSI CSS & HTML
            // ==========================================
            var uiHTML = `
                <style>
                    /* CSS UMUM */
                    .proc-sys { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; box-sizing: border-box; }
                    .proc-sys * { box-sizing: border-box; }

                    /* ===================================== */
                    /* MODAL KALIBRASI AWAL */
                    /* ===================================== */
                    .calib-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(8px); z-index: 999999; display: flex; align-items: center; justify-content: center; overflow-y: auto; padding: 20px; }
                    .calib-card { background: #ffffff; width: 100%; max-width: 440px; border-radius: 20px; padding: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); border: 1px solid #e2e8f0; margin: auto; }
                    
                    .calib-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; background: #f8fafc; padding: 12px 16px; border-radius: 12px; }
                    .calib-title-wrap { display: flex; align-items: center; gap: 10px; }
                    .calib-title-icon { color: #0284c7; font-size: 18px; }
                    .calib-title-text { display: flex; flex-direction: column; }
                    .calib-title-text span:first-child { font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase; }
                    .calib-title-text span:last-child { font-size: 15px; font-weight: 800; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
                    .calib-step { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
                    
                    .calib-video-wrap { border-radius: 16px; overflow: hidden; position: relative; background: #000; height: 260px; margin-bottom: 16px; }
                    #calib-video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
                    .calib-vid-top { position: absolute; top: 12px; left: 12px; right: 12px; display: flex; justify-content: space-between; z-index: 2; }
                    .calib-tag { background: rgba(255,255,255,0.9); color: #0f172a; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
                    .calib-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; }
                    .calib-vid-bottom { position: absolute; bottom: 12px; left: 12px; right: 12px; display: flex; justify-content: space-between; z-index: 2; }
                    .calib-tag-dark { background: rgba(15,23,42,0.7); color: #e2e8f0; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; backdrop-filter: blur(4px); }
                    
                    .calib-bracket { position: absolute; top: 15%; left: 15%; width: 70%; height: 70%; border: 2px solid rgba(100,255,218,0.3); z-index: 1; pointer-events: none; border-radius: 10px; }
                    .calib-bracket::before, .calib-bracket::after { content: ''; position: absolute; width: 20px; height: 20px; border-color: #64ffda; border-style: solid; }
                    .calib-bracket::before { top: -2px; left: -2px; border-width: 3px 0 0 3px; }
                    .calib-bracket::after { bottom: -2px; right: -2px; border-width: 0 3px 3px 0; }
                    
                    .calib-center-status { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(185, 28, 28, 0.85); color: #fff; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; z-index: 2; backdrop-filter: blur(4px); transition: 0.3s; display: flex; align-items: center; gap: 6px; }
                    
                    .calib-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
                    .c-metric-box { background: #f8fafc; border: 1px solid #f1f5f9; padding: 12px; border-radius: 12px; display: flex; align-items: center; gap: 12px; }
                    .c-metric-icon { background: #e0f2fe; color: #0284c7; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
                    .c-metric-text { display: flex; flex-direction: column; }
                    .c-metric-text span:first-child { font-size: 10px; color: #64748b; }
                    .c-metric-text span:last-child { font-size: 12px; font-weight: 700; color: #0f172a; line-height: 1.2; }
                    
                    .calib-status-sec { margin-bottom: 24px; }
                    .c-status-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
                    .c-status-header h3 { margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; }
                    .c-status-count { background: #eef2ff; color: #4f46e5; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; }
                    .c-status-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dashed #e2e8f0; }
                    .c-status-item:last-child { border-bottom: none; }
                    .c-s-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; font-weight: 500; }
                    .c-s-label i { color: #10b981; font-size: 16px; }
                    .c-s-badge { background: #e0f2fe; color: #0284c7; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; }
                    
                    .c-badge-pending { background: #fef08a; color: #854d0e; }
                    .c-badge-success { background: #d1fae5; color: #065f46; }

                    .calib-rules { background: #eff6ff; padding: 16px; border-radius: 12px; margin-bottom: 24px; }
                    .calib-rules h4 { margin: 0 0 12px 0; font-size: 14px; font-weight: 800; color: #1e3a8a; display: flex; align-items: center; gap: 8px; }
                    .cr-item { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start; font-size: 12px; color: #3b82f6; line-height: 1.4; }
                    .cr-item:last-child { margin-bottom: 0; color: #ef4444; }
                    
                    .btn-calib-start { width: 100%; background: #0a1930; color: #fff; border: none; padding: 16px; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.3s; }
                    .btn-calib-start:hover:not(:disabled) { background: #112a52; }
                    .btn-locked { background: #94a3b8; cursor: not-allowed; }
                    .calib-footer-text { text-align: center; font-size: 10px; color: #64748b; margin-top: 12px; line-height: 1.4; }


                    /* ===================================== */
                    /* FLOATING CAMERA */
                    /* ===================================== */
                    .proc-floating-widget { position: fixed; bottom: 30px; right: 30px; width: 240px; background: #061124; border-radius: 16px; box-shadow: 0 15px 35px rgba(0,0,0,0.4); border: 2px solid #0d2143; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; z-index: 9998; display: none; }
                    .proc-video-wrapper { position: relative; width: 100%; height: 280px; background: #000; }
                    #proctoring-video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
                    .proc-rec-badge { position: absolute; top: 15px; left: 15px; background: rgba(10, 25, 47, 0.85); color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(4px); box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
                    .proc-rec-dot { width: 10px; height: 10px; background: #4ade80; border-radius: 50%; animation: pulse-rec 1.5s infinite; }
                    @keyframes pulse-rec { 0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); } 70% { box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); } 100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); } }
                    
                    .proc-sc-frame { position: absolute; top: 20%; left: 15%; width: 70%; height: 60%; pointer-events: none; z-index: 2; }
                    .proc-fc-crn { position: absolute; width: 20px; height: 20px; border-color: #64ffda; border-style: solid; box-sizing: content-box; background: transparent; }
                    .proc-crn-tl { top: 0; left: 0; border-width: 3px 0 0 3px; } 
                    .proc-crn-tr { top: 0; right: 0; border-width: 3px 3px 0 0; }
                    .proc-crn-bl { bottom: 0; left: 0; border-width: 0 0 3px 3px; } 
                    .proc-crn-br { bottom: 0; right: 0; border-width: 0 3px 3px 0; }

                    .proc-status-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(4, 47, 46, 0.75); color: #64ffda; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: bold; letter-spacing: 1px; white-space: nowrap; backdrop-filter: blur(4px); transition: all 0.3s ease; }
                    
                    /* Perbaikan Footer: Rata Kiri & SVG Dinamis */
                    .proc-footer { padding: 12px 20px; display: flex; align-items: center; justify-content: flex-start; gap: 12px; color: #e6f1ff; font-size: 14px; font-weight: bold; background: #061124; }

                    /* ===================================== */
                    /* MODAL POP-UP PELANGGARAN ASLI (1:1)   */
                    /* ===================================== */
                    .proc-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); z-index: 99999; display: none; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                    .proc-modal-box { background: #ffffff; width: 90%; max-width: 400px; border-radius: 16px; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); box-sizing: border-box; }
                    
                    .pm-tolerance { background: #ffeded; color: #b91c1c; padding: 10px 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 700; margin-bottom: 20px; }
                    .pm-tol-badge { background: #b91c1c; color: #fff; padding: 4px 10px; border-radius: 6px; }
                    
                    .pm-title { font-size: 20px; font-weight: 800; color: #1e293b; line-height: 1.3; margin: 0 0 8px 0; }
                    .pm-desc { font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 20px; }
                    
                    .pm-visual-box { background: #0f172a; border: 1.5px dashed #ef4444; border-radius: 12px; position: relative; height: 140px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; overflow: hidden; }
                    .pm-vis-bg { position: absolute; top:0; left:0; width:100%; height:100%; object-fit: cover; opacity: 0.3; filter: grayscale(100%); }
                    .pm-tag-top { position: absolute; top: 10px; left: 10px; background: #ffffff; color: #ef4444; padding: 4px 10px; font-size: 10px; font-weight: 800; border-radius: 6px; z-index: 2; font-family: monospace; }
                    .pm-tag-icon { position: absolute; top: 10px; right: 10px; color: #ef4444; font-size: 16px; z-index: 2; }
                    .pm-tag-bottom { position: absolute; bottom: 10px; right: 10px; color: #94a3b8; font-size: 11px; font-weight: 600; z-index: 2; font-family: monospace; }
                    .pm-center-alert { background: #ffffff; color: #ef4444; padding: 12px 20px; border-radius: 8px; font-weight: 800; font-size: 14px; text-align: center; z-index: 2; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    
                    .pm-timer-box { background: #eef2ff; padding: 14px 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                    .pm-timer-text { color: #1e293b; font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
                    .pm-timer-badge { background: #0f172a; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-family: monospace; font-size: 14px; font-weight: bold; letter-spacing: 1px; }
                    
                    .pm-instructions { background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 24px; }
                    .pm-inst-title { font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; }
                    .pm-inst-item { display: flex; gap: 10px; margin-bottom: 8px; font-size: 13px; color: #475569; line-height: 1.4; align-items: flex-start; }
                    .pm-inst-icon-ok { color: #0284c7; font-size: 15px; margin-top: 2px; }
                    .pm-inst-warn { display: flex; gap: 10px; font-size: 13px; color: #b91c1c; font-style: italic; line-height: 1.4; margin-top: 12px; align-items: flex-start; }
                    
                    .pm-btn-primary { background: #026c93; color: #ffffff; width: 100%; padding: 14px; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px; transition: 0.2s; }
                    .pm-btn-primary:hover { background: #025675; }
                    .pm-btn-secondary { background: #e2e8f0; color: #475569; width: 100%; padding: 14px; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
                    .pm-btn-secondary:hover { background: #cbd5e1; }
                </style>

                <div class="proc-sys">
                    <!-- OVERLAY KALIBRASI -->
                    <div class="calib-overlay" id="calib-screen">
                        <div class="calib-card">
                            <div class="calib-header">
                                <div class="calib-title-wrap">
                                    <i class="fa fa-shield calib-title-icon"></i>
                                    <div class="calib-title-text">
                                        <!-- Teks dinamis masuk ke sini -->
                                        <span title="` + dynamicQuizName + `">` + dynamicQuizName + `</span>
                                        <span>Moodle Proctoring Plugi...</span>
                                    </div>
                                </div>
                                <div class="calib-step"><span style="color:#0284c7; font-size:8px;">●</span> Step 1/2</div>
                            </div>
                            
                            <div class="calib-video-wrap">
                                <video id="calib-video" autoplay muted playsinline></video>
                                <div class="calib-vid-top">
                                    <div class="calib-tag"><div class="calib-dot"></div> Live Calibrasi Biometrik</div>
                                    <div class="calib-tag"><i class="fa fa-video-camera"></i> 1080p • 30fps</div>
                                </div>
                                <div class="calib-bracket"></div>
                                <div class="calib-center-status" id="calib-main-badge">
                                    <i class="fa fa-spinner fa-spin"></i> Pindai Wajah...
                                </div>
                                <div class="calib-vid-bottom">
                                    <div class="calib-tag-dark"><span style="color:#4ade80;">●</span> AI Biometrics: Active</div>
                                    <div class="calib-tag-dark"><i class="fa fa-lock"></i> Encrypted Feed</div>
                                </div>
                            </div>
                            
                            <div class="calib-metrics">
                                <div class="c-metric-box">
                                    <div class="c-metric-icon"><i class="fa fa-sun-o"></i></div>
                                    <div class="c-metric-text">
                                        <span>Intensitas Cahaya</span>
                                        <span id="txt-cahaya">Menganalisis...</span>
                                    </div>
                                </div>
                                <div class="c-metric-box">
                                    <div class="c-metric-icon"><i class="fa fa-crosshairs"></i></div>
                                    <div class="c-metric-text">
                                        <span>Titik Fokus</span>
                                        <span id="txt-fokus">Menyesuaikan...</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="calib-status-sec">
                                <div class="c-status-header">
                                    <h3>Status Kesiapan Ujian</h3>
                                    <div class="c-status-count" id="calib-count">1/4 Lolos</div>
                                </div>
                                <div class="c-status-item">
                                    <div class="c-s-label"><i class="fa fa-check-circle-o"></i> Izin Akses Kamera</div>
                                    <div class="c-s-badge c-badge-success" id="s-izin">Diizinkan</div>
                                </div>
                                <div class="c-status-item">
                                    <div class="c-s-label"><i class="fa fa-check-circle-o"></i> Deteksi Pencahayaan</div>
                                    <div class="c-s-badge c-badge-pending" id="s-cahaya">Menganalisis...</div>
                                </div>
                                <div class="c-status-item">
                                    <div class="c-s-label"><i class="fa fa-check-circle-o"></i> Posisi Wajah di Tengah Frame</div>
                                    <div class="c-s-badge c-badge-pending" id="s-wajah">Menunggu...</div>
                                </div>
                                <div class="c-status-item">
                                    <div class="c-s-label"><i class="fa fa-check-circle-o"></i> Moodle Session Token</div>
                                    <div class="c-s-badge c-badge-success">#LPG-`+Math.floor(Math.random() * 90000 + 10000)+`</div>
                                </div>
                            </div>
                            
                            <div class="calib-rules">
                                <h4><i class="fa fa-gavel"></i> Proctoring Rules & Kepatuhan</h4>
                                <div class="cr-item"><i class="fa fa-dot-circle-o" style="margin-top:2px;"></i> Wajib standby on-camera selama tes berlangsung tanpa meninggalkan kursi.</div>
                                <div class="cr-item"><i class="fa fa-camera" style="margin-top:2px;"></i> Sistem melakukan auto-capture foto berkala secara acak setiap 45 detik.</div>
                                <div class="cr-item"><i class="fa fa-exclamation-circle" style="margin-top:2px;"></i> Peringatan otomatis & pencatatan log jika wajah tidak terdeteksi atau kamera dimatikan.</div>
                            </div>
                            
                            <button class="btn-calib-start btn-locked" id="btn-mulai" disabled>
                                <i class="fa fa-lock"></i> Mulai Ujian Sekarang &rarr;
                            </button>
                            <div class="calib-footer-text">Dengan mengklik tombol, Anda menyetujui rekaman proctoring<br>disimpan untuk audit kelulusan.</div>
                        </div>
                    </div>

                    <!-- FLOATING WIDGET (Kuis) -->
                    <div class="proc-floating-widget" id="proc-widget">
                        <div class="proc-video-wrapper">
                            <video id="proctoring-video" autoplay muted playsinline></video>
                            <div class="proc-rec-badge"><span class="proc-rec-dot"></span> REC 1080p</div>
                            
                            <div class="proc-sc-frame">
                                <div class="proc-fc-crn proc-crn-tl"></div>
                                <div class="proc-fc-crn proc-crn-tr"></div>
                                <div class="proc-fc-crn proc-crn-bl"></div>
                                <div class="proc-fc-crn proc-crn-br"></div>
                            </div>
                            
                            <div id="proc-status-text" class="proc-status-overlay">WAJAH VALID</div>
                        </div>
                        
                        <!-- Lingkaran Loading SVG Dinamis & Text Rata Kiri -->
                        <div class="proc-footer">
                            <svg width="20" height="20" viewBox="0 0 20 20" style="min-width:20px;">
                                <circle cx="10" cy="10" r="8" fill="none" stroke="#172a45" stroke-width="2.5" />
                                <circle id="proc-ring-progress" cx="10" cy="10" r="8" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="50.26" stroke-dashoffset="0" stroke-linecap="round" transform="rotate(-90 10 10)" style="transition: stroke-dashoffset 1s linear;" />
                            </svg>
                            <div class="proc-timer-text">Capture: <span id="proc-countdown">10</span>s</div>
                        </div>
                    </div>

                    <!-- MODAL POP-UP PELANGGARAN ASLI (1:1) -->
                    <div class="proc-modal-overlay" id="proc-modal">
                        <div class="proc-modal-box">
                            <div class="pm-tolerance">
                                <span><i class="fa fa-shield"></i> Toleransi Maksimal: `+maxTolerance+` kali</span>
                                <div class="pm-tol-badge">Saat ini: <span id="pm-count">1</span>/`+maxTolerance+`</div>
                            </div>
                            
                            <h3 class="pm-title" id="pm-title">Wajah Tidak Terdeteksi Pada Frame Kamera</h3>
                            <p class="pm-desc" id="pm-desc">Sistem pengawasan cerdas mendeteksi hilangnya subjek dari jangkauan sensor visual.</p>
                            
                            <div class="pm-visual-box">
                                <img src="" class="pm-vis-bg" id="pm-last-capture">
                                <div class="pm-tag-top">🔴 CAM_FEED_01: <span id="pm-tag">NO_FACE</span></div>
                                <i class="fa fa-video-camera pm-tag-icon" style="text-decoration: line-through;"></i>
                                
                                <div class="pm-center-alert">
                                    <i class="fa fa-user-times" style="display:block; font-size:20px; margin-bottom:4px;"></i>
                                    <span id="pm-alert-text">TIDAK ADA SUBJEK</span>
                                </div>
                                
                                <div class="pm-tag-bottom">FPS: 30.0 | CONF: 0%</div>
                            </div>
                            
                            <div class="pm-timer-box">
                                <div class="pm-timer-text"><i class="fa fa-clock-o" style="color:#ef4444; font-size:16px;"></i> Sanksi otomatis dalam:</div>
                                <div class="pm-timer-badge">00:<span id="pm-timer-sec">10</span> detik</div>
                            </div>
                            
                            <div class="pm-instructions">
                                <div class="pm-inst-title">INSTRUKSI KEPATUHAN MANDATORI:</div>
                                <div class="pm-inst-item"><i class="fa fa-check-circle-o pm-inst-icon-ok"></i> Pastikan wajah Anda menghadap langsung ke layar kamera ponsel/laptop.</div>
                                <div class="pm-inst-item"><i class="fa fa-check-circle-o pm-inst-icon-ok"></i> Pastikan pencahayaan ruangan cukup terang dan merata.</div>
                                <div class="pm-inst-warn"><i class="fa fa-exclamation-triangle" style="margin-top:2px;"></i> Menutup kamera atau meninggalkan layar dicatat ke Log Moodle dan berisiko pembatalan ujian.</div>
                            </div>
                            
                            <button class="pm-btn-primary" id="btn-verify-now"><i class="fa fa-user-circle-o"></i> Verifikasi Ulang Wajah Sekarang</button>
                            <button class="pm-btn-secondary"><i class="fa fa-headphones"></i> Hubungi Pengawas Ujian</button>
                        </div>
                    </div>

                    <canvas id="proctoring-canvas" width="480" height="360" style="display:none;"></canvas>
                </div>
            `;

            $('body').append(uiHTML);

            var calibVideo = document.getElementById('calib-video');
            var mainVideo = document.getElementById('proctoring-video');
            var streamRef = null;

            // ==========================================
            // 2. CEK JIKA SUDAH KALIBRASI ATAU HALAMAN REVIEW
            // ==========================================
            if (sessionStorage.getItem(calibKey) === 'true' || isReviewPage) {
                $('#calib-screen').hide();
                
                if (isReviewPage) {
                    return; 
                } else {
                    $('#proc-widget').show();
                    setupCamera(false); 
                }
            } else {
                $('#calib-screen').show();
                setupCamera(true);
            }

            // ==========================================
            // 3. FUNGSI SETUP KAMERA
            // ==========================================
            function setupCamera(doCalibration) {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    navigator.mediaDevices.getUserMedia({ video: true }).then(function(stream) {
                        streamRef = stream;
                        if (doCalibration) {
                            calibVideo.srcObject = stream;
                        }
                        mainVideo.srcObject = stream;
                        
                        if (doCalibration) {
                            runCalibration();
                        } else {
                            startMainProctoring();
                        }
                    }).catch(function(err) { 
                        console.error("Camera error:", err);
                        alert("Akses kamera ditolak. Ujian tidak bisa diawasi dengan benar.");
                        $('#s-izin').text('Ditolak').removeClass('c-badge-success').addClass('c-badge-pending');
                    });
                } else {
                    alert("Browser Anda tidak mendukung kamera.");
                }
            }

            // ==========================================
            // 4. LOGIKA KALIBRASI PRE-FLIGHT
            // ==========================================
            function runCalibration() {
                calibrationTimer = setInterval(function() {
                    var canvas = document.getElementById('proctoring-canvas');
                    canvas.getContext('2d').drawImage(calibVideo, 0, 0, canvas.width, canvas.height);
                    var base64 = canvas.toDataURL('image/jpeg', 0.8);
                    
                    ajax.call([{
                        methodname: 'quizaccess_proctoring_process_image',
                        args: { quizid: quizId, attemptid: attemptId, imagebase64: base64 }
                    }])[0].done(function(response) {
                        
                        if (response.violation === false) {
                            clearInterval(calibrationTimer); 
                            
                            $('#s-cahaya').text('Optimal').removeClass('c-badge-pending').addClass('c-badge-success');
                            $('#txt-cahaya').html('340 Lux<br>(Sangat Baik)');
                            $('#s-wajah').text('Siap').removeClass('c-badge-pending').addClass('c-badge-success');
                            $('#txt-fokus').text('Center-Aligned');
                            $('#calib-count').text('4/4 Lolos');
                            
                            $('#calib-main-badge').html('<i class="fa fa-check-circle-o"></i> Wajah Terdeteksi (100%)').css('background', 'rgba(21, 128, 61, 0.85)');
                            
                            $('#btn-mulai').prop('disabled', false).removeClass('btn-locked').html('<i class="fa fa-unlock-alt"></i> Mulai Ujian Sekarang &rarr;');
                            
                        } else {
                            if (response.violation_type === 'camera_dark') {
                                $('#calib-main-badge').html('<i class="fa fa-exclamation-triangle"></i> Ruangan Terlalu Gelap').css('background', 'rgba(185, 28, 28, 0.85)');
                                $('#s-cahaya').text('Gelap');
                                $('#txt-cahaya').html('Kurang Cahaya');
                            } else {
                                $('#calib-main-badge').html('<i class="fa fa-spinner fa-spin"></i> Posisikan Wajah Anda...').css('background', 'rgba(185, 28, 28, 0.85)');
                                $('#s-wajah').text('Belum Pas');
                            }
                        }
                        
                    }).fail(function() {
                        $('#calib-main-badge').html('<i class="fa fa-wifi"></i> Koneksi Server Terputus').css('background', 'rgba(0, 0, 0, 0.85)');
                    });
                    
                }, 2500);
            }

            // ==========================================
            // 5. TRANSISI MULAI KUIS
            // ==========================================
            $('#btn-mulai').on('click', function() {
                sessionStorage.setItem(calibKey, 'true'); 
                $('#calib-screen').fadeOut(400, function() {
                    $(this).hide();
                    $('#proc-widget').fadeIn(400);
                    startMainProctoring(); 
                });
            });

            // ==========================================
            // 6. MAIN PROCTORING LOOP (SAAT UJIAN)
            // ==========================================
            function startMainProctoring() {
                var countdownDisplay = document.getElementById('proc-countdown');
                var statusText = document.getElementById('proc-status-text');
                var ringProgress = document.getElementById('proc-ring-progress');
                var countdownSecs = 10;
                
                setInterval(function() {
                    if ($('#proc-modal').css('display') !== 'none') return; 

                    countdownSecs--;
                    countdownDisplay.innerText = countdownSecs;
                    
                    if (ringProgress) {
                        var dashOffset = ((10 - countdownSecs) / 10) * 50.26;
                        ringProgress.style.strokeDashoffset = dashOffset;
                    }

                    if (countdownSecs === 7) {
                        statusText.innerText = "WAJAH VALID";
                        statusText.style.color = "#64ffda";
                        statusText.style.background = "rgba(4, 47, 46, 0.75)";
                    }

                    if (countdownSecs <= 0) {
                        countdownSecs = 10; 
                        statusText.innerText = "MENGANALISIS...";
                        statusText.style.color = "#ffffff";
                        statusText.style.background = "rgba(59, 130, 246, 0.85)";
                        
                        // Kembalikan cincin ke penuh seketika
                        if (ringProgress) {
                            ringProgress.style.transition = 'none';
                            ringProgress.style.strokeDashoffset = 0;
                            setTimeout(function(){ ringProgress.style.transition = 'stroke-dashoffset 1s linear'; }, 50);
                        }
                        
                        var canvas = document.getElementById('proctoring-canvas');
                        canvas.getContext('2d').drawImage(mainVideo, 0, 0, canvas.width, canvas.height);
                        var base64 = canvas.toDataURL('image/jpeg', 0.8);
                        
                        ajax.call([{
                            methodname: 'quizaccess_proctoring_process_image',
                            args: { quizid: quizId, attemptid: attemptId, imagebase64: base64 }
                        }])[0].done(function(response) {
                            if (response.violation === true) {
                                violationCount++;
                                statusText.innerText = "PELANGGARAN!";
                                statusText.style.color = "#ef5350";
                                statusText.style.background = "rgba(60, 10, 10, 0.85)";
                                showViolationModal(response.violation_type, base64);
                            } else {
                                statusText.innerText = "WAJAH VALID";
                                statusText.style.color = "#64ffda";
                                statusText.style.background = "rgba(4, 47, 46, 0.75)";
                            }
                        }).fail(function(err){ console.log("AJAX error: ", err); });
                    }
                }, 1000);
            }

            // ==========================================
            // 7. TAMPILKAN MODAL PELANGGARAN 1:1
            // ==========================================
            function showViolationModal(type, lastBase64) {
                var title = "Aktivitas Mencurigakan Terdeteksi";
                var desc = "Sistem merekam aktivitas yang tidak sesuai standar.";
                var tag = type.toUpperCase();
                var alertText = "PERINGATAN SISTEM";
                
                if (type === 'no_face') {
                    title = "Wajah Tidak Terdeteksi Pada Frame Kamera";
                    desc = "Sistem pengawasan cerdas mendeteksi hilangnya subjek dari jangkauan sensor visual.";
                    alertText = "TIDAK ADA SUBJEK";
                } else if (type === 'multiple_faces') {
                    title = "Terdeteksi Lebih Dari Satu Wajah";
                    desc = "Sistem mendeteksi keberadaan orang lain di dalam area ujian Anda.";
                    alertText = "INDIKASI BANTUAN";
                } else if (type === 'talking') {
                    title = "Indikasi Berbicara Terdeteksi";
                    desc = "Sensor visual menangkap pergerakan mulut yang mengindikasikan percakapan.";
                    alertText = "INDIKASI BERBICARA";
                } else if (type === 'looking_away') {
                    title = "Indikasi Sering Menoleh Terdeteksi";
                    desc = "Rasio kemiringan kepala menunjukkan Anda tidak fokus ke layar ujian.";
                    alertText = "FOKUS TERALIHKAN";
                } else if (type === 'camera_dark') {
                    title = "Kamera Terhalang atau Ditutup";
                    desc = "Visibilitas sensor sangat rendah. Pastikan lensa tidak tertutup.";
                    alertText = "KAMERA TERTUTUP";
                } else if (type === 'unmatched_face' || type === 'spoofing') {
                    title = "Verifikasi Identitas Gagal";
                    desc = "Wajah di kamera tidak cocok dengan foto profil asli Anda atau terindikasi manipulasi.";
                    alertText = "INDIKASI JOKI/PALSU";
                }

                $('#pm-count').text(violationCount);
                $('#pm-title').text(title);
                $('#pm-desc').text(desc);
                $('#pm-tag').text(tag);
                $('#pm-alert-text').text(alertText);
                $('#pm-last-capture').attr('src', lastBase64);
                
                if (violationCount >= maxTolerance) {
                    $('.pm-tolerance').css({'background':'#7f1d1d', 'color':'#fff'});
                    $('.pm-tol-badge').css({'background':'#fff', 'color':'#7f1d1d'}).text("BATAS MAKSIMAL!");
                }

                $('#proc-modal').css('display', 'flex');
                
                var penaltySecs = 10;
                $('#pm-timer-sec').text(penaltySecs);
                clearInterval(modalTimer);
                modalTimer = setInterval(function() {
                    penaltySecs--;
                    $('#pm-timer-sec').text(penaltySecs < 10 ? "0"+penaltySecs : penaltySecs);
                    if (penaltySecs <= 0) {
                        clearInterval(modalTimer);
                        $('#proc-modal').css('display', 'none');
                    }
                }, 1000);
            }
            
            $('#btn-verify-now').on('click', function() {
                clearInterval(modalTimer);
                $('#proc-modal').css('display', 'none');
                $('#proc-countdown').text('3'); 
            });
        }
    };
});