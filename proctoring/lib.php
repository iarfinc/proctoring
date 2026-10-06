<?php
defined('MOODLE_INTERNAL') || die();

/**
 * Fungsi ini otomatis dipanggil oleh Moodle saat ada yang mencoba mengakses URL file gambar dari plugin ini.
 */
function quizaccess_proctoring_pluginfile($course, $cm, $context, $filearea, $args, $forcedownload, array $options=array()) {
    
    // Pastikan konteksnya ada di level modul (kuis)
    if ($context->contextlevel != CONTEXT_MODULE) {
        return false;
    }
    
    require_login($course, true, $cm);
    
    // Hanya user dengan hak akses melihat report (Guru/Admin) yang bisa melihat foto bukti
    if (!has_capability('mod/quiz:viewreports', $context)) {
        return false;
    }
    
    if ($filearea !== 'evidence') {
        return false;
    }
    
    $itemid = array_shift($args);
    $filename = array_pop($args);
    
    $fs = get_file_storage();
    $file = $fs->get_file($context->id, 'quizaccess_proctoring', $filearea, $itemid, '/', $filename);
    
    if (!$file || $file->is_directory()) {
        return false;
    }
    
    // Kirim file gambar ke browser
    send_stored_file($file, 0, 0, $forcedownload, $options);
}