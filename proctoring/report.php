<?php
// Lokasi: mod/quiz/accessrule/proctoring/report.php

require_once('../../../../config.php');

// Ambil ID Kuis dari parameter URL
$quizid = required_param('quizid', PARAM_INT);

// Verifikasi Moodle (Sistem Keamanan)
$cm = get_coursemodule_from_instance('quiz', $quizid, 0, false, MUST_EXIST);
$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
$quiz = $DB->get_record('quiz', array('id' => $quizid), '*', MUST_EXIST);

require_login($course, false, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/quiz:viewreports', $context);

// Query Data Global dari Tabel Proctoring
$sql = "SELECT p.*, u.firstname AS p_fname, u.lastname AS p_lname, u.email AS p_email 
        FROM {quizaccess_proctoring} p
        JOIN {user} u ON p.userid = u.id
        WHERE p.quizid = ? AND p.status = 1
        ORDER BY p.timecreated DESC";
        
$records = $DB->get_records_sql($sql, array($quizid));

// Analitik untuk Pie Chart
$kasus_noface = 0;
$kasus_multiface = 0;
$kasus_talking = 0;
$kasus_lookingaway = 0;
$kasus_cameradark = 0;
$kasus_unmatched = 0;
$kasus_spoofing = 0;

if ($records) {
    foreach ($records as $r) {
        if ($r->violation_type == 'no_face') $kasus_noface++;
        elseif ($r->violation_type == 'multiple_faces') $kasus_multiface++;
        elseif ($r->violation_type == 'talking') $kasus_talking++;
        elseif ($r->violation_type == 'looking_away') $kasus_lookingaway++;
        elseif ($r->violation_type == 'camera_dark') $kasus_cameradark++;
        elseif ($r->violation_type == 'unmatched_face') $kasus_unmatched++;
        elseif ($r->violation_type == 'spoofing') $kasus_spoofing++;
    }
}
$total_insiden = count($records);

// Setup Halaman
$PAGE->set_url('/mod/quiz/accessrule/proctoring/report.php', array('quizid' => $quizid));
$PAGE->set_context($context);
$PAGE->set_title('Dashboard Integritas: ' . $quiz->name);
$PAGE->set_heading($course->fullname);

echo $OUTPUT->header();
?>

<!-- Import Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script> 
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"> 

<!-- CSS Modern SaaS (Luwes & Elegan) -->
<style>
    .corp-dashboard { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #fafbfc; padding: 25px; border-radius: 20px; box-sizing: border-box; width: 100%; overflow-x: hidden; }
    
    .corp-header { background: linear-gradient(135deg, #8B1C31 0%, #5A111F 100%); color: #ffffff; padding: 35px 40px; border-radius: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 25px rgba(139, 28, 49, 0.15); border: none; }
    .corp-header h2 { margin: 0; font-size: 26px; font-weight: 700; color: #fff; letter-spacing: -0.5px; }
    .corp-header p { margin: 8px 0 0 0; color: #ffd6dc; font-size: 15px; font-weight: 400; }
    
    /* Grid Layout */
    .corp-grid { display: grid; grid-template-columns: 320px 1fr; gap: 30px; width: 100%; }
    @media (max-width: 1024px) { .corp-grid { grid-template-columns: 1fr; } }
    
    /* Kartu Widget */
    .corp-card { background: #ffffff; border-radius: 20px; padding: 30px; box-shadow: 0 8px 24px rgba(0,0,0,0.03); border: 1px solid #f4f5f7; min-width: 0; }
    .corp-card-title { font-size: 17px; font-weight: 700; color: #333; margin-bottom: 25px; display: flex; align-items: center; gap: 12px; }
    .corp-card-title::before { content: ''; display: inline-block; width: 4px; height: 18px; background: #8B1C31; border-radius: 4px; }
    
    /* Tabel Data */
    .corp-table-wrap { overflow-x: auto; }
    .corp-table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .corp-table th { background: #fdf4f5; color: #8B1C31; padding: 16px 20px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; font-weight: 700; border-bottom: none; }
    .corp-table th:first-child { border-top-left-radius: 10px; border-bottom-left-radius: 10px; }
    .corp-table th:last-child { border-top-right-radius: 10px; border-bottom-right-radius: 10px; }
    .corp-table td { padding: 18px 20px; border-bottom: 1px solid #f4f5f7; font-size: 14px; color: #495057; vertical-align: middle; }
    .corp-table tbody tr:hover td { background-color: #fafbfc; }
    
    /* Indikator Status & Label */
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; box-shadow: 0 0 0 3px rgba(255,255,255,0.5); }
    .label-violation { font-weight: 600; font-size: 13px; display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 6px; background: #f8f9fa; border: 1px solid #eee; }
    
    /* Tombol Back */
    .btn-corp { display: inline-block; padding: 10px 20px; background: transparent; color: #8B1C31; border: 1.5px solid #8B1C31; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; transition: all 0.2s ease; margin-top: 20px;}
    .btn-corp:hover { background: #8B1C31; color: #ffffff; text-decoration: none; box-shadow: 0 4px 10px rgba(139, 28, 49, 0.2); transform: translateY(-1px); }
    
    /* Gambar Bukti */
    .img-evidence { width: 120px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05); transition: transform 0.2s; cursor: zoom-in; }
    .img-evidence:hover { transform: scale(1.1); }
</style> 

<div class="corp-dashboard">
    
    <!-- Top Bar -->
    <div class="corp-header">
        <div>
            <h2>Detail Laporan AI Proctoring</h2> 
            <p>Sistem Pemantauan Perilaku - <?php echo format_string($quiz->name); ?></p> 
        </div>
        <div style="text-align: right; background: rgba(255,255,255,0.1); padding: 10px 20px; border-radius: 12px; backdrop-filter: blur(5px);">
            <span style="font-size: 32px; font-weight: 800; line-height: 1;"><?php echo $total_insiden; ?></span><br> 
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Total Insiden</span> 
        </div>
    </div>

    <div class="corp-grid">
        <div class="corp-card">
            <div class="corp-card-title">Distribusi Pelanggaran</div> 
            <div style="position: relative; height: 280px; width: 100%;">
                <canvas id="severityChart"></canvas> 
            </div>
            <div style="margin-top: 30px; font-size: 13px; color: #555;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span><span class="status-dot" style="background: #d32f2f;"></span> Wajah Menghilang</span> 
                    <strong><?php echo $kasus_noface; ?></strong> 
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span><span class="status-dot" style="background: #f57c00;"></span> >1 Wajah</span> 
                    <strong><?php echo $kasus_multiface; ?></strong> 
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span><span class="status-dot" style="background: #8e24aa;"></span> Indikasi Bicara</span> 
                    <strong><?php echo $kasus_talking; ?></strong> 
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span><span class="status-dot" style="background: #0288d1;"></span> Sering Menoleh</span> 
                    <strong><?php echo $kasus_lookingaway; ?></strong> 
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span><span class="status-dot" style="background: #333;"></span> Kamera Ditutup</span> 
                    <strong><?php echo $kasus_cameradark; ?></strong> 
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span><span class="status-dot" style="background: #c62828;"></span> Indikasi Joki</span> 
                    <strong><?php echo $kasus_unmatched; ?></strong> 
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span><span class="status-dot" style="background: #e91e63;"></span> Foto Palsu/Spoofing</span>
                    <strong><?php echo $kasus_spoofing; ?></strong>
                </div>
            </div>
        </div>

        <div class="corp-card">
            <div class="corp-card-title">Log Deteksi Kamera AI</div> 
            <div class="corp-table-wrap">
                <table class="corp-table">
                    <thead>
                        <tr>
                            <th>Waktu Analisis</th> 
                            <th>Peserta Asesmen</th> 
                            <th>Attempt</th> 
                            <th>Jenis Pelanggaran</th> 
                            <th>Akurasi AI</th> 
                            <th>Bukti Visual</th> 
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($records)): ?> 
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 50px 20px; color: #888;"> 
                                <i class="fa fa-shield" style="font-size: 40px; color: #e2e8f0; display: block; margin-bottom: 15px;"></i> 
                                <span style="font-size: 16px; font-weight: 500;">Seluruh asesmen terpantau bersih dan aman.</span> 
                            </td>
                        </tr>
                        <?php else: ?>
                            <?php foreach ($records as $r): ?> 
                            <?php 
                                $peserta = trim($r->p_fname . ' ' . $r->p_lname);
                                
                                if ($r->violation_type == 'no_face') {
                                    $violation_text = '<span class="label-violation" style="color:#d32f2f;"><span class="status-dot" style="background:#d32f2f;"></span> Wajah Menghilang</span>';
                                } elseif ($r->violation_type == 'multiple_faces') {
                                    $violation_text = '<span class="label-violation" style="color:#f57c00;"><span class="status-dot" style="background:#f57c00;"></span> >1 Wajah</span>';
                                } elseif ($r->violation_type == 'talking') {
                                    $violation_text = '<span class="label-violation" style="color:#8e24aa;"><span class="status-dot" style="background:#8e24aa;"></span> Indikasi Bicara</span>';
                                } elseif ($r->violation_type == 'looking_away') {
                                    $violation_text = '<span class="label-violation" style="color:#0288d1;"><span class="status-dot" style="background:#0288d1;"></span> Sering Menoleh</span>';
                                } elseif ($r->violation_type == 'camera_dark') {
                                    $violation_text = '<span class="label-violation" style="color:#333;"><span class="status-dot" style="background:#333;"></span> Kamera Ditutup</span>';
                                } elseif ($r->violation_type == 'unmatched_face') {
                                    $violation_text = '<span class="label-violation" style="color:#c62828;"><span class="status-dot" style="background:#c62828;"></span> Terindikasi Joki</span>';
                                } elseif ($r->violation_type == 'spoofing') { 
                                    $violation_text = '<span class="label-violation" style="color:#e91e63;"><span class="status-dot" style="background:#e91e63;"></span> Objek Palsu/Spoofing</span>';
                                } else {
                                    $violation_text = '<span class="label-violation">Aktivitas Mencurigakan</span>';
                                }
                                
                                $skor_ai = (float)$r->confidence_score . '%';

                                $imagehtml = '<span style="color:#aaa; font-style:italic;">No Image</span>';
                                if (!empty($r->imagefile)) {
                                    $url = moodle_url::make_pluginfile_url(
                                        $context->id,  
                                        'quizaccess_proctoring', 
                                        'evidence', 
                                        $r->id, 
                                        '/', 
                                        $r->imagefile
                                    );
                                    $imagehtml = '<a href="'.$url.'" target="_blank"><img src="'.$url.'" class="img-evidence" alt="Bukti Pelanggaran"></a>';
                                }
                            ?>
                            <tr>
                                <td>
                                    <span style="color: #333; font-weight: 500; display: block;"><?php echo date('d M Y', $r->timecreated); ?></span> 
                                    <span style="font-size: 12px; color: #999;"><?php echo date('H:i:s', $r->timecreated); ?></span> 
                                </td>
                                <td>
                                    <strong style="color: #2c3e50; font-size: 15px;"><?php echo $peserta; ?></strong><br> 
                                    <span style="font-size: 12px; color: #888;"><?php echo $r->p_email; ?></span> 
                                </td>
                                <td style="text-align: center; font-weight: 600; color: #666;"> 
                                    <?php echo $r->attemptid; ?> 
                                </td>
                                <td>
                                    <?php echo $violation_text; ?> 
                                </td>
                                <td style="font-weight: 600; color: #333;"> 
                                    <?php echo $skor_ai; ?> 
                                </td>
                                <td>
                                    <?php echo $imagehtml; ?> 
                                </td>
                            </tr>
                            <?php endforeach; ?> 
                        <?php endif; ?> 
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    
    <a href="<?php echo new moodle_url('/mod/quiz/view.php', array('id' => $cm->id)); ?>" class="btn-corp"> 
        <i class="fa fa-arrow-left" style="margin-right: 8px;"></i> Kembali ke Halaman Kuis 
    </a> 
</div>

<script>
document.addEventListener("DOMContentLoaded", function() { 
    var ctx = document.getElementById('severityChart').getContext('2d'); 
    
    new Chart(ctx, { 
        type: 'doughnut', 
        data: { 
            labels: [ 
                'Wajah Menghilang',  
                'Lebih dari 1 Wajah',  
                'Indikasi Bicara',  
                'Sering Menoleh',  
                'Kamera Ditutup',  
                'Indikasi Joki', 
                'Foto Palsu (Spoofing)' 
            ],
            datasets: [{ 
                data: [ 
                    <?php echo $kasus_noface; ?>,  
                    <?php echo $kasus_multiface; ?>, 
                    <?php echo $kasus_talking; ?>, 
                    <?php echo $kasus_lookingaway; ?>, 
                    <?php echo $kasus_cameradark; ?>, 
                    <?php echo $kasus_unmatched; ?>, 
                    <?php echo $kasus_spoofing; ?>
                ],
                backgroundColor: [ 
                    '#d32f2f', // Merah (No face)
                    '#f57c00', // Orange (Multi face)
                    '#8e24aa', // Ungu (Talking)
                    '#0288d1', // Biru (Looking away)
                    '#333333', // Hitam/Abu Tua (Camera Dark)
                    '#c62828', // Merah Gelap (Unmatched)
                    '#e91e63'  // Pink Gelap (Spoofing)
                ],
                borderWidth: 0, 
                hoverOffset: 6 
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            layout: { padding: 10 }, 
            plugins: { 
                legend: { display: false },  
                tooltip: { 
                    backgroundColor: 'rgba(255,255,255,0.95)', 
                    titleColor: '#333', 
                    bodyColor: '#666', 
                    borderColor: '#eee', 
                    borderWidth: 1, 
                    padding: 12, 
                    boxPadding: 6, 
                    callbacks: { 
                        label: function(context) { 
                            return ' ' + context.label + ': ' + context.raw + ' Kasus'; 
                        } 
                    } 
                } 
            },
            cutout: '75%'  
        }
    });
});
</script>

<?php
echo $OUTPUT->footer(); 