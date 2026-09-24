import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Sistem lokalisasi sederhana untuk Gudang 6 Mobile.
/// Mendukung Bahasa Indonesia ('id') dan 简体中文 ('zh').
/// Setiap user menyimpan preferensi bahasanya sendiri di SharedPreferences.

final ValueNotifier<String> globalLocale = ValueNotifier('id');

class AppLocale {
  /// Inisialisasi bahasa dari SharedPreferences saat startup.
  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('locale');
    if (saved != null && (saved == 'id' || saved == 'zh')) {
      globalLocale.value = saved;
    }
  }

  /// Ganti bahasa dan simpan ke SharedPreferences.
  static Future<void> setLocale(String locale) async {
    globalLocale.value = locale;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('locale', locale);
  }

  /// Fungsi terjemahan utama. Gunakan: AppLocale.t('key')
  static String t(String key) {
    final locale = globalLocale.value;
    return _translations[key]?[locale] ?? _translations[key]?['id'] ?? key;
  }

  static const Map<String, Map<String, String>> _translations = {
    // ===== UMUM =====
    'app_title': {'id': 'Gudang 6 Mobile', 'zh': '仓库6移动端'},
    'save': {'id': 'Simpan', 'zh': '保存'},
    'cancel': {'id': 'Batal', 'zh': '取消'},
    'close': {'id': 'Tutup', 'zh': '关闭'},
    'search': {'id': 'Cari...', 'zh': '搜索...'},
    'loading': {'id': 'Memuat...', 'zh': '加载中...'},
    'no_data': {'id': 'Tidak ada data', 'zh': '没有数据'},
    'success': {'id': 'Berhasil', 'zh': '成功'},
    'failed': {'id': 'Gagal', 'zh': '失败'},
    'error': {'id': 'Terjadi kesalahan', 'zh': '发生错误'},
    'retry': {'id': 'Coba lagi', 'zh': '重试'},
    'confirm': {'id': 'Konfirmasi', 'zh': '确认'},
    'delete': {'id': 'Hapus', 'zh': '删除'},
    'edit': {'id': 'Edit', 'zh': '编辑'},
    'back': {'id': 'Kembali', 'zh': '返回'},
    'yes': {'id': 'Ya', 'zh': '是'},
    'no': {'id': 'Tidak', 'zh': '否'},

    // ===== LOGIN =====
    'login': {'id': 'Masuk', 'zh': '登录'},
    'login_title': {'id': 'Inventaris Gudang 6', 'zh': '仓库6库存管理'},
    'login_subtitle': {'id': 'Sistem Manajemen Inventaris', 'zh': '库存管理系统'},
    'login_with_google': {'id': 'Login dengan Google', 'zh': '使用Google登录'},
    'employee_id': {'id': 'ID Karyawan', 'zh': '员工编号'},
    'password': {'id': 'Password', 'zh': '密码'},
    'enter_employee_id': {'id': 'Masukkan ID Karyawan', 'zh': '请输入员工编号'},
    'enter_password': {'id': 'Masukkan Password', 'zh': '请输入密码'},
    'login_failed': {'id': 'Login gagal', 'zh': '登录失败'},
    'login_error': {'id': 'ID atau password salah', 'zh': '编号或密码错误'},
    'or': {'id': 'atau', 'zh': '或'},

    // ===== NAVIGASI BAWAH =====
    'reception': {'id': 'CC Penerimaan Material', 'zh': '材料接收'},
    'fleet_list': {'id': 'Daftar Armada', 'zh': '船队列表'},
    'scanner': {'id': 'Scanner', 'zh': '扫描'},
    'profile': {'id': 'Profil', 'zh': '个人资料'},

    // ===== OVERVIEW TAB =====
    'overview': {'id': 'Ringkasan', 'zh': '概览'},
    'total_items': {'id': 'Total Barang', 'zh': '货物总计'},
    'inspected': {'id': 'Sudah Diinspeksi', 'zh': '已检查'},
    'not_inspected': {'id': 'Belum Diinspeksi', 'zh': '未检查'},
    'inspection_progress': {'id': 'Progres Inspeksi', 'zh': '检查进度'},
    'good_condition': {'id': 'Baik', 'zh': '良好'},
    'damaged': {'id': 'Rusak', 'zh': '损坏'},
    'completed': {'id': 'Selesai', 'zh': '完成'},
    'waiting_inspection': {'id': 'Menunggu Inspeksi', 'zh': '等待检查'},
    'recent_activity': {'id': 'Aktivitas Terkini', 'zh': '近期活动'},
    'no_recent': {'id': 'Belum ada aktivitas', 'zh': '暂无活动'},
    'items_unit': {'id': 'barang', 'zh': '件'},

    // ===== SHIP TAB =====
    'ship_list': {'id': 'Daftar Kapal', 'zh': '船舶列表'},
    'ship': {'id': 'Kapal', 'zh': '船舶'},
    'containers_count': {'id': 'kontainer', 'zh': '个集装箱'},
    'items_count': {'id': 'barang', 'zh': '件货物'},
    'connection_unstable': {'id': 'Koneksi tidak stabil. Gagal memuat data.', 'zh': '网络不稳定，无法加载数据。'},
    'no_fleet_data': {'id': 'Belum ada data armada kapal.', 'zh': '暂无船舶数据。'},
    'type': {'id': 'Tipe', 'zh': '类型'},
    'item': {'id': 'Item', 'zh': '件'},
    'update': {'id': 'Update', 'zh': '更新'},
    'items_inspected': {'id': 'item diinspeksi', 'zh': '件已检查'},
    'not_updated_yet': {'id': 'Belum diupdate', 'zh': '尚未更新'},
    'search_item': {'id': 'Cari nama barang atau PO...', 'zh': '搜索商品名称或PO编号...'},
    'no_items': {'id': 'Tidak ada barang.', 'zh': '没有货物。'},
    'item_not_found': {'id': 'Barang tidak ditemukan.', 'zh': '未找到货物。'},
    'sequential_share': {'id': 'Pengiriman Bertahap', 'zh': '逐步发送'},
    'sequential_share_desc': {'id': 'WeChat membatasi pengiriman banyak barang sekaligus. Silakan kirim satu per satu:', 'zh': '企业微信限制一次发送过多项目。请逐个发送：'},
    'send': {'id': 'Kirim', 'zh': '发送'},
    'no_container_found': {'id': 'Tidak ada kontainer ditemukan.', 'zh': '未找到集装箱。'},
    'no_container': {'id': 'Tanpa Kontainer', 'zh': '无集装箱'},

    // ===== CONTAINERS PAGE =====
    'container': {'id': 'Kontainer', 'zh': '集装箱'},
    'container_list': {'id': 'Daftar Kontainer', 'zh': '集装箱列表'},
    'select_all': {'id': 'Pilih Semua', 'zh': '全选'},
    'deselect_all': {'id': 'Batal Pilih Semua', 'zh': '取消全选'},

    // ===== ITEMS PAGE =====
    'items': {'id': 'Data Barang', 'zh': '货物数据'},
    'item_detail': {'id': 'Detail Barang', 'zh': '货物详情'},
    'status': {'id': 'Status', 'zh': '状态'},
    'quantity': {'id': 'Jumlah', 'zh': '数量'},
    'po_number': {'id': 'Nomor PO', 'zh': 'PO编号'},
    'description': {'id': 'Deskripsi', 'zh': '描述'},
    'photo': {'id': 'Foto', 'zh': '照片'},
    'no_photo': {'id': 'Belum ada foto', 'zh': '暂无照片'},

    // ===== INSPECTION PAGE =====
    'inspection': {'id': 'Inspeksi', 'zh': '检查'},
    'inspect': {'id': 'Inspeksi', 'zh': '检查'},
    'send_report': {'id': 'Kirim Laporan', 'zh': '发送报告'},
    'take_photo': {'id': 'Ambil Foto', 'zh': '拍照'},
    'choose_from_gallery': {'id': 'Pilih dari Galeri', 'zh': '从相册选择'},
    'overall': {'id': 'OVERALL', 'zh': '总体'},
    'done': {'id': 'Selesai', 'zh': '已完成'},
    'on_process': {'id': 'On Proses', 'zh': '处理中'},
    'not_updated': {'id': 'Belum Update', 'zh': '未更新'},
    'last_7_days': {'id': 'AKTIVITAS 7 HARI TERAKHIR', 'zh': '最近7天活动'},
    'ongoing_updates': {'id': 'Ongoing Container Updates', 'zh': '进行中的集装箱更新'},
    'no_container_updates': {'id': 'Belum ada pembaruan kontainer.', 'zh': '尚无集装箱更新。'},
    'unnamed': {'id': 'Tanpa Nomor', 'zh': '无编号'},
    'mon': {'id': 'Sen', 'zh': '一'},
    'tue': {'id': 'Sel', 'zh': '二'},
    'wed': {'id': 'Rab', 'zh': '三'},
    'thu': {'id': 'Kam', 'zh': '四'},
    'fri': {'id': 'Jum', 'zh': '五'},
    'sat': {'id': 'Sab', 'zh': '六'},
    'sun': {'id': 'Min', 'zh': '日'},
    'today': {'id': 'Hari Ini', 'zh': '今天'},
    'admin_share_hub': {'id': 'Admin Share Hub', 'zh': '管理员共享中心'},
    'native_share_report': {'id': 'Native Share Laporan', 'zh': '本地共享报告'},
    'logout': {'id': 'Keluar', 'zh': '退出'},
    'failed_load_data': {'id': 'Gagal memuat data:\n', 'zh': '加载数据失败：\n'},
    'no_ship_data': {'id': 'Belum ada data kapal/kontainer.', 'zh': '尚无船舶/集装箱数据。'},
    'containers_items': {'id': '{containers} Kontainer • {items} Item', 'zh': '{containers} 个集装箱 • {items} 件货物'},
    'container_detail': {'id': 'Detail Kontainer', 'zh': '集装箱详情'},
    'no_items_found': {'id': 'Tidak ada barang ditemukan.', 'zh': '未找到货物。'},
    'container_number': {'id': 'Nomor Kontainer', 'zh': '集装箱编号'},
    'share_all': {'id': 'Share Semua', 'zh': '全部分享'},
    'item_without_name': {'id': 'Barang Tanpa Nama', 'zh': '无名货物'},
    'info': {'id': 'Ket: ', 'zh': '备注：'},
    'share_this_item': {'id': 'Share Item Ini', 'zh': '分享此货物'},
    'select_status': {'id': 'Pilih Status', 'zh': '选择状态'},
    'scanner_ocr': {'id': 'Scanner OCR', 'zh': 'OCR扫描仪'},
    'scan_shipping_mark': {'id': 'Pindai Shipping Mark', 'zh': '扫描唛头'},
    'preparing_camera': {'id': 'Menyiapkan kamera...', 'zh': '正在准备相机...'},
    'formatting_image': {'id': 'Mengubah format gambar...', 'zh': '正在转换图像格式...'},
    'processing_ocr': {'id': 'Memproses OCR (Membaca Teks)...', 'zh': '正在处理OCR（读取文本）...'},
    'ocr_error': {'id': 'OCR Error: ', 'zh': 'OCR错误：'},
    'no_text_detected': {'id': 'Tidak ada teks yang terdeteksi dari foto.\n\n(OCR returned empty result)', 'zh': '未检测到照片中的文本。\n\n(OCR 返回空结果)'},
    'searching_database': {'id': 'Mencari kecocokan di database...', 'zh': '正在数据库中查找匹配项...'},
    'no_match_found': {'id': 'Tidak ditemukan barang yang cocok dengan hasil pindaian:\n\n', 'zh': '未找到与扫描结果匹配的货物：\n\n'},
    'scan_shipping_mark_desc': {'id': 'Pindai Shipping Mark\nuntuk mencari barang', 'zh': '扫描唛头\n以查找货物'},
    'error_occurred': {'id': 'Terjadi kesalahan: ', 'zh': '发生错误：'},
    'scanned_containers_error': {'id': 'Koneksi tidak stabil. Gagal memuat data kontainer.', 'zh': '网络不稳定，无法加载集装箱数据。'},
    'no_container_for_item': {'id': 'Tidak ditemukan kontainer untuk barang ini', 'zh': '未找到此货物的集装箱'},
    'inspected_progress': {'id': '{completed}/{total} Diinspeksi', 'zh': '{completed}/{total} 已检查'},
    'open_camera': {'id': 'Buka Kamera', 'zh': '打开相机'},
    // 'failed' already defined
    'photo_required': {'id': 'Foto wajib diambil', 'zh': '必须拍照'},
    'sending': {'id': 'Mengirim...', 'zh': '发送中...'},
    'report_sent': {'id': 'Laporan berhasil dikirim', 'zh': '报告发送成功'},
    'report_failed': {'id': 'Gagal mengirim laporan', 'zh': '报告发送失败'},
    'saving_data': {'id': 'Menyimpan data', 'zh': '保存数据'},
    'wecom_queue_added': {'id': 'Laporan ditambahkan ke Antrean WeCom', 'zh': '报告已添加到企业微信队列'},

    // ===== SCANNER =====
    'scan_container': {'id': 'Pindai Kontainer', 'zh': '扫描集装箱'},
    'scan_instruction': {'id': 'Arahkan kamera ke nomor kontainer', 'zh': '将相机对准集装箱编号'},
    'scan_result': {'id': 'Hasil Pindai', 'zh': '扫描结果'},
    'no_match': {'id': 'Tidak ditemukan', 'zh': '未找到'},
    'scanned_containers': {'id': 'Kontainer Terpindai', 'zh': '已扫描集装箱'},

    // ===== PROFIL =====
    'change_name': {'id': 'Ganti Nama', 'zh': '更改姓名'},
    'change_password': {'id': 'Ganti Password', 'zh': '更改密码'},
    'google_account': {'id': 'Akun Google', 'zh': 'Google账号'},
    'linked': {'id': 'Terkait', 'zh': '已关联'},
    'link_account': {'id': 'Tautkan', 'zh': '关联'},
    'link_google_failed': {'id': 'Gagal menautkan akun Google', 'zh': 'Google账号关联失败'},
    'dark_theme': {'id': 'Tema Gelap', 'zh': '深色主题'},
    'language': {'id': 'Bahasa', 'zh': '语言'},
    // 'logout' already defined
    'no_name': {'id': 'Tanpa Nama', 'zh': '未命名'},
    'add_cover_photo': {'id': 'Tambah Foto Sampul', 'zh': '添加封面照片'},
    'enter_new_name': {'id': 'Masukkan nama baru', 'zh': '请输入新姓名'},
    'enter_new_password': {'id': 'Masukkan password baru', 'zh': '请输入新密码'},
    'name_changed': {'id': 'Nama berhasil diubah!', 'zh': '姓名修改成功！'},
    'name_change_failed': {'id': 'Gagal mengubah nama', 'zh': '姓名修改失败'},
    'password_changed': {'id': 'Password berhasil diubah!', 'zh': '密码修改成功！'},
    'password_change_failed': {'id': 'Gagal mengubah password', 'zh': '密码修改失败'},
    'photo_changed': {'id': 'Foto profil berhasil diubah!', 'zh': '头像修改成功！'},
    'photo_change_failed': {'id': 'Gagal mengunggah foto', 'zh': '头像上传失败'},
    'cover_changed': {'id': 'Foto sampul berhasil diubah!', 'zh': '封面照片修改成功！'},
    'cover_change_failed': {'id': 'Gagal mengunggah foto sampul', 'zh': '封面照片上传失败'},
    'profile_load_failed': {'id': 'Gagal memuat profil', 'zh': '加载资料失败'},

    // ===== ADMIN =====
    'admin_panel': {'id': 'Panel Admin', 'zh': '管理面板'},
    'change_logo': {'id': 'Ganti Logo', 'zh': '更换标志'},
    'logo_changed': {'id': 'Logo berhasil diubah!', 'zh': '标志更换成功！'},
    'logo_change_failed': {'id': 'Gagal mengubah logo', 'zh': '标志更换失败'},
    'total_data': {'id': 'Total Data', 'zh': '数据总计'},

    // ===== BAHASA =====
    'bahasa_indonesia': {'id': 'Bahasa Indonesia', 'zh': '印度尼西亚语'},
    'bahasa_china': {'id': '简体中文 (Mandarin)', 'zh': '简体中文'},
    'select_language': {'id': 'Pilih Bahasa', 'zh': '选择语言'},
  };
}
