<?php
defined('MOODLE_INTERNAL') || die();

// BARIS SAKTI: Memaksa Moodle mengubah status plugin di database menjadi AKTIF (0 = tidak didisable)
set_config('disabled', 0, 'quizaccess_proctoring');

if ($ADMIN->fulltree) {
    $settings->add(new admin_setting_configtext(
        'quizaccess_proctoring/api_url',
        get_string('api_url', 'quizaccess_proctoring'),
        get_string('api_url_desc', 'quizaccess_proctoring'),
        'http://127.0.0.1:8000/analyze-frame',
        PARAM_URL
    ));
}