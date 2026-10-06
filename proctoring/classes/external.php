<?php
namespace quizaccess_proctoring;

defined('MOODLE_INTERNAL') || die();

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_value;
use core_external\external_single_structure;

class external extends external_api {

    public static function process_image_parameters() {
        return new external_function_parameters([
            'quizid'      => new external_value(PARAM_INT, 'ID Kuis'),
            'attemptid'   => new external_value(PARAM_INT, 'ID Percobaan Kuis'),
            'imagebase64' => new external_value(PARAM_RAW, 'Gambar Base64')
        ]);
    }

    // UPDATE 1: Menambahkan variabel violation dan violation_type agar bisa dibaca oleh JavaScript
    public static function process_image_returns() {
        return new external_single_structure([
            'status'         => new external_value(PARAM_BOOL, 'Status berhasil'),
            'message'        => new external_value(PARAM_TEXT, 'Pesan sistem'),
            'violation'      => new external_value(PARAM_BOOL, 'Ada pelanggaran', VALUE_OPTIONAL),
            'violation_type' => new external_value(PARAM_TEXT, 'Jenis pelanggaran', VALUE_OPTIONAL)
        ]);
    }

    public static function process_image($quizid, $attemptid, $imagebase64) {
        global $DB, $USER;

        $params = self::validate_parameters(self::process_image_parameters(), [
            'quizid'      => $quizid,
            'attemptid'   => $attemptid,
            'imagebase64' => $imagebase64
        ]);

        $image_parts = explode(";base64,", $params['imagebase64']);
        if (count($image_parts) != 2) {
            return ['status' => false, 'message' => 'Format gambar invalid', 'violation' => false];
        }
        $image_binary = base64_decode($image_parts[1]);

        $fs = get_file_storage();
        $usercontext = \context_user::instance($USER->id);
        $files = $fs->get_area_files($usercontext->id, 'user', 'icon', 0, 'timecreated DESC', false);
        
        $profile_base64 = '';
        foreach ($files as $file) {
            if (!$file->is_directory()) {
                $profile_base64 = base64_encode($file->get_content());
                break;
            }
        }

        $python_url = get_config('quizaccess_proctoring', 'api_url');
        if (empty($python_url)) {
            $python_url = 'http://127.0.0.1:8000/analyze-frame';
        }

        $ch = curl_init($python_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'imagebase64' => $image_parts[1],
            'profilebase64' => $profile_base64
        ]));
        
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10); 
        $response = curl_exec($ch);
        curl_close($ch);

        if ($response) {
            $ai_result = json_decode($response);

            if (isset($ai_result->violation) && $ai_result->violation == true) {
                try {
                    $log = new \stdClass();
                    $log->quizid = $params['quizid'];
                    $log->userid = $USER->id;
                    $log->attemptid = $params['attemptid'];
                    $log->timecreated = time();
                    $log->status = 1; 
                    $log->violation_type = $ai_result->violation_type;
                    $log->confidence_score = $ai_result->confidence_score;
                    
                    $logid = $DB->insert_record('quizaccess_proctoring', $log);

                    $cm = get_coursemodule_from_instance('quiz', $params['quizid']);
                    if ($cm) {
                        $context = \context_module::instance($cm->id);
                        $filename = 'evidence_' . $params['attemptid'] . '_' . time() . '.jpg';
                        $filerecord = array(
                            'contextid'   => $context->id,
                            'component'   => 'quizaccess_proctoring',
                            'filearea'    => 'evidence',
                            'itemid'      => $logid, 
                            'filepath'    => '/',
                            'filename'    => $filename,
                            'timecreated' => time(),
                            'userid'      => $USER->id
                        );
                        $fs->create_file_from_string($filerecord, $image_binary);
                        $DB->set_field('quizaccess_proctoring', 'imagefile', $filename, ['id' => $logid]);
                    }
                    
                    // UPDATE 2: Kembalikan status pelanggaran ke JavaScript
                    return [
                        'status' => true, 
                        'message' => 'Pelanggaran dicatat', 
                        'violation' => true, 
                        'violation_type' => $ai_result->violation_type
                    ];
                    
                } catch (\Exception $e) {
                    return ['status' => false, 'message' => 'Error penyimpanan: ' . $e->getMessage(), 'violation' => false];
                }
            }
        } else {
            return ['status' => false, 'message' => 'Gagal menghubungi server Python.', 'violation' => false];
        }

        // Jika AI tidak mendeteksi pelanggaran (Aman)
        return ['status' => true, 'message' => 'Frame aman', 'violation' => false, 'violation_type' => 'none'];
    }
}