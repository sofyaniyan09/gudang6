import 'dart:io';

void main() {
  final file = File('mobile_app/lib/screens/overview_tab.dart');
  String code = file.readAsStringSync();
  
  // Find the diffDays logic
  final oldLogic = '''          final diffDays = todayStart.difference(updateStart).inDays;
          if (diffDays >= 0 && diffDays < 7) {''';
          
  final newLogic = '''          int diffDays = todayStart.difference(updateStart).inDays;
          if (diffDays < 0) diffDays = 0; // Fix timezone mismatch pushing date into future
          
          if (diffDays >= 0 && diffDays < 7) {''';
          
  code = code.replaceAll(oldLogic, newLogic);
  file.writeAsStringSync(code);
  print('Patched overview_tab.dart');
}
