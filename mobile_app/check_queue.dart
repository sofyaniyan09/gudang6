import 'package:supabase/supabase.dart';
import 'dart:io';

void main() async {
  final supabaseUrl = 'YOUR_URL';
  final supabaseKey = 'YOUR_KEY';
  // Read .env.local
  final lines = File('.env.local').readAsLinesSync();
  String url = '';
  String key = '';
  for (var line in lines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1];
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1];
  }
  
  final client = SupabaseClient(url, key);
  final q = await client.from('wecom_queue').select('*');
  print('QUEUE: $q');
  final l = await client.from('wecom_locks').select('*').catchError((e) => null);
  print('LOCKS: $l');
  exit(0);
}
