import 'dart:io';

void main() {
  final file = File('mobile_app/lib/screens/ship_tab.dart');
  String code = file.readAsStringSync();
  
  if (!code.contains('RealtimeChannel? _realtimeChannel;')) {
    final stateDecl = 'class _ShipTabState extends State<ShipTab> with RouteAware, TitleUpdater<ShipTab> {';
    final stateVars = '''class _ShipTabState extends State<ShipTab> with RouteAware, TitleUpdater<ShipTab> {
  RealtimeChannel? _realtimeChannel;''';
    code = code.replaceFirst(stateDecl, stateVars);
    
    final initMethod = '''  void initState() {
    super.initState();
    _fetchShips();''';
    final initNew = '''  void initState() {
    super.initState();
    _fetchShips();
    _setupRealtime();''';
    code = code.replaceFirst(initMethod, initNew);
    
    final fetchMethod = '''  Future<void> _fetchShips() async {''';
    final realtimeMethod = '''
  void _setupRealtime() {
    _realtimeChannel = supabase.channel('public:penerimaan_kapal_ships')
      ..onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'penerimaan_kapal',
          callback: (payload) {
            print('Realtime update received in ShipTab');
            _fetchShips();
          })
      ..subscribe();
  }
  
  @override
  void dispose() {
    _realtimeChannel?.unsubscribe();
    super.dispose();
  }

  Future<void> _fetchShips() async {''';
    code = code.replaceFirst(fetchMethod, realtimeMethod);
    file.writeAsStringSync(code);
    print('Patched ship_tab.dart for realtime');
  } else {
    print('Already patched ship_tab.dart');
  }
}
