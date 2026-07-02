import 'dart:io';

void main() {
  final file = File('mobile_app/lib/screens/overview_tab.dart');
  String code = file.readAsStringSync();
  
  if (!code.contains('RealtimeChannel? _realtimeChannel;')) {
    final stateDecl = 'class _OverviewTabState extends State<OverviewTab> {';
    final stateVars = '''class _OverviewTabState extends State<OverviewTab> {
  RealtimeChannel? _realtimeChannel;''';
    code = code.replaceFirst(stateDecl, stateVars);
    
    final initMethod = '''  void initState() {
    super.initState();
    _fetchOverviewData();''';
    final initNew = '''  void initState() {
    super.initState();
    _fetchOverviewData();
    _setupRealtime();''';
    code = code.replaceFirst(initMethod, initNew);
    
    final fetchMethod = '''  Future<void> _fetchOverviewData() async {''';
    final realtimeMethod = '''
  void _setupRealtime() {
    _realtimeChannel = supabase.channel('public:penerimaan_kapal')
      ..onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'penerimaan_kapal',
          callback: (payload) {
            print('Realtime update received in OverviewTab: \${payload.toString()}');
            _fetchOverviewData();
          })
      ..subscribe();
  }
  
  @override
  void dispose() {
    _realtimeChannel?.unsubscribe();
    super.dispose();
  }

  Future<void> _fetchOverviewData() async {''';
    code = code.replaceFirst(fetchMethod, realtimeMethod);
    file.writeAsStringSync(code);
    print('Patched overview_tab.dart for realtime');
  } else {
    print('Already patched overview_tab.dart');
  }
}
