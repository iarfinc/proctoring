<?php
// Lokasi: mod/quiz/accessrule/proctoring/rule.php (di ROOT plugin)

defined('MOODLE_INTERNAL') || die();

use mod_quiz\local\access_rule_base;

class quizaccess_proctoring extends access_rule_base {
    
    public static function make(\mod_quiz\quiz_settings $quizobj, $timenow, $canignoretimelimits) {
        return new self($quizobj, $timenow);
    }
    
    public function prevent_access() { 
        return false; 
    }
    
    public function setup_attempt_page($page) {
        global $PAGE;
        
        // Ambil ID Kuis dan ID Percobaan
        $quizid = $this->quizobj->get_quizid();
        $attemptid = optional_param('attempt', 0, PARAM_INT); 
        
        // Memanggil fungsi init() di dalam mod/quiz/accessrule/proctoring/amd/src/kamera.js
        $PAGE->requires->js_call_amd('quizaccess_proctoring/kamera', 'init', [$quizid, $attemptid]);
    }
    
    public function description() {
        return [get_string('pluginname', 'quizaccess_proctoring')];
    }
}