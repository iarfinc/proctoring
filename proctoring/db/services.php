<?php
defined('MOODLE_INTERNAL') || die();
$functions = [
    'quizaccess_proctoring_process_image' => [
        'classname'     => 'quizaccess_proctoring\external',
        'methodname'    => 'process_image',
        'description'   => 'Memproses gambar base64 dari kamera',
        'type'          => 'write',
        'ajax'          => true,
        'loginrequired' => true,
    ]
];