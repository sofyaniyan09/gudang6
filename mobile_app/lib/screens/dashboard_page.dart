import 'package:flutter/material.dart';
import '../main.dart';
import '../widgets/obsidian_scaffold.dart';
import '../widgets/glass_card.dart';
import 'containers_page.dart';
import 'profile_page.dart';
import 'scanner_page.dart';
import 'package:curved_navigation_bar/curved_navigation_bar.dart';
import 'overview_tab.dart';
import 'ship_tab.dart';
import '../utils/route_observer.dart';

class DashboardPage extends StatefulWidget {
  final int initialIndex;
  const DashboardPage({super.key, this.initialIndex = 0});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  late int _selectedIndex;
  final GlobalKey<NavigatorState> _overviewTabNavigatorKey =
      GlobalKey<NavigatorState>();
  final GlobalKey<NavigatorState> _shipTabNavigatorKey =
      GlobalKey<NavigatorState>();
  final GlobalKey<NavigatorState> _scannerTabNavigatorKey =
      GlobalKey<NavigatorState>();
  final GlobalKey<NavigatorState> _profileTabNavigatorKey =
      GlobalKey<NavigatorState>();

  List<String?> _tabTitles = ['CC Penerimaan Material', 'Daftar Armada', 'Scanner', 'Profil'];

  @override
  void initState() {
    super.initState();
    _selectedIndex = widget.initialIndex;
    nestedRouteTitle.addListener(_onTitleChanged);
  }

  void _onTitleChanged() {
    setState(() {
      _tabTitles[_selectedIndex] = nestedRouteTitle.value;
    });
  }

  @override
  void dispose() {
    nestedRouteTitle.removeListener(_onTitleChanged);
    super.dispose();
  }

  Future<void> _logout() async {
    await supabase.auth.signOut();
    if (mounted) {
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  Widget _buildTabNavigator(
      GlobalKey<NavigatorState> key, String title, Widget child) {
    final observer = nestedRouteObservers[title]!;
    return TabObserverProvider(
      observer: observer,
      child: Navigator(
        key: key,
        observers: [observer],
        onGenerateRoute: (settings) {
          return MaterialPageRoute(builder: (context) {
            return TabRoot(
              title: title,
              child: child,
            );
          });
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvoked: (didPop) async {
        if (didPop) return;

        final keys = [
          _overviewTabNavigatorKey,
          _shipTabNavigatorKey,
          _scannerTabNavigatorKey,
          _profileTabNavigatorKey
        ];

        final currentKey = keys[_selectedIndex];
        if (currentKey.currentState?.canPop() == true) {
          currentKey.currentState?.pop();
        } else if (_selectedIndex != 0) {
          setState(() {
            _selectedIndex = 0;
          });
        }
      },
      child: ObsidianScaffold(
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leadingWidth: 72,
          leading: ValueListenableBuilder<String?>(
            valueListenable: nestedRouteTitle,
            builder: (context, title, child) {
              final isRoot = title == 'CC Penerimaan Material' ||
                  title == 'Daftar Armada' ||
                  title == 'Scanner' ||
                  title == 'Pencarian' ||
                  title == 'Profil';
              if (title != null && !isRoot) {
                return IconButton(
                  icon: const Icon(Icons.arrow_back, color: Color(0xFFAAC7FF)),
                  onPressed: () {
                    final keys = [
                      _overviewTabNavigatorKey,
                      _shipTabNavigatorKey,
                      _scannerTabNavigatorKey,
                      _profileTabNavigatorKey
                    ];
                    keys[_selectedIndex].currentState?.maybePop();
                  },
                );
              }
              return Padding(
                padding: const EdgeInsets.only(left: 24.0),
                child: Image.asset(
                  'assets/logo_transparent.png',
                  height: 32,
                ),
              );
            },
          ),
          title: AnimatedBuilder(
            animation:
                Listenable.merge([nestedRouteTitle, nestedRouteSubtitle]),
            builder: (context, child) {
              String titleToDisplay = 'Inventaris Gudang 6';
              String? subtitleToDisplay;

              if (nestedRouteTitle.value != null) {
                titleToDisplay = nestedRouteTitle.value!;
                subtitleToDisplay = nestedRouteSubtitle.value;
              } else {
                switch (_selectedIndex) {
                  case 0:
                    titleToDisplay = 'CC Penerimaan Material';
                    break;
                  case 1:
                    titleToDisplay = 'Daftar Armada';
                    break;
                  case 2:
                    titleToDisplay = 'Scanner';
                    break;
                  case 3:
                    titleToDisplay = 'Pencarian';
                    break;
                  case 4:
                    titleToDisplay = 'Profil';
                    break;
                  default:
                    titleToDisplay = 'Inventaris Gudang 6';
                }
              }

              if (subtitleToDisplay != null && subtitleToDisplay.isNotEmpty) {
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      titleToDisplay,
                      style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFE0E2ED)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      subtitleToDisplay,
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.normal,
                          color: Color(0xFFAAC7FF)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                );
              }

              return Text(
                titleToDisplay,
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFE0E2ED)),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              );
            },
          ),
          centerTitle: true,
          actions: [
            ValueListenableBuilder<String?>(
              valueListenable: nestedRouteTitle,
              builder: (context, title, child) {
                if (title == 'Daftar Kontainer' || title == 'Data Barang') {
                  return IconButton(
                    icon: const Icon(Icons.search,
                        color: Color(0xFFAAC7FF), size: 28),
                    onPressed: () {
                      globalSearchActive.value = !globalSearchActive.value;
                    },
                  );
                }
                return const SizedBox.shrink();
              },
            ),
            ValueListenableBuilder<String?>(
              valueListenable: nestedRouteTitle,
              builder: (context, title, child) {
                if (title == 'Data Barang') {
                  return ValueListenableBuilder<bool>(
                    valueListenable: globalIsAllSelected,
                    builder: (context, isAllSelected, child) {
                      return IconButton(
                        icon: Icon(
                          isAllSelected ? Icons.check_box : Icons.check_box_outline_blank,
                          color: const Color(0xFFAAC7FF),
                          size: 26,
                        ),
                        onPressed: () {
                          globalSelectAllTrigger.value++;
                        },
                      );
                    }
                  );
                }
                return const SizedBox.shrink();
              },
            ),
            Padding(
              padding: const EdgeInsets.only(right: 16.0),
              child: IconButton(
                icon: const Icon(Icons.notifications_outlined,
                    color: Color(0xFFAAC7FF), size: 28),
                onPressed: () {},
              ),
            ),
          ],
        ),
        body: IndexedStack(
          index: _selectedIndex,
          children: [
            _buildTabNavigator(
                _overviewTabNavigatorKey, 'CC Penerimaan Material', const OverviewTab()),
            _buildTabNavigator(
                _shipTabNavigatorKey, 'Daftar Armada', const ShipTab()),
            _buildTabNavigator(
                _scannerTabNavigatorKey,
                'Scanner',
                const ScannerPage()),
            _buildTabNavigator(
                _profileTabNavigatorKey, 'Profil', const ProfilePage()),
          ],
        ),
        bottomNavigationBar: CurvedNavigationBar(
          index: _selectedIndex,
          height: 60.0,
          items: <Widget>[
            Icon(Icons.home_outlined,
                size: 30,
                color: _selectedIndex == 0
                    ? const Color(0xFF003064)
                    : Colors.white),
            Icon(Icons.directions_boat_outlined,
                size: 30,
                color: _selectedIndex == 1
                    ? const Color(0xFF003064)
                    : Colors.white),
            Icon(Icons.qr_code_scanner,
                size: 30,
                color: _selectedIndex == 2
                    ? const Color(0xFF003064)
                    : Colors.white),
            Icon(Icons.person_outline,
                size: 30,
                color: _selectedIndex == 3
                    ? const Color(0xFF003064)
                    : Colors.white),
          ],
          color: const Color(0xFF414754).withOpacity(0.6),
          buttonBackgroundColor: const Color(0xFFAAC7FF),
          backgroundColor: Colors.transparent,
          animationCurve: Curves.easeInOut,
          animationDuration: const Duration(milliseconds: 300),
          onTap: (index) {
            final keys = [
              _overviewTabNavigatorKey,
              _shipTabNavigatorKey,
              _scannerTabNavigatorKey,
              _profileTabNavigatorKey
            ];
            final currentKey = keys[index];

            // If tapping the already active tab, pop to the root of that tab's navigator
            if (_selectedIndex == index) {
              currentKey.currentState?.popUntil((route) => route.isFirst);
            }

            setState(() {
              _selectedIndex = index;
            });

            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (currentKey.currentState?.canPop() == true) {
                nestedRouteTitle.value = _tabTitles[index];
              } else {
                final defaultTitles = ['CC Penerimaan Material', 'Daftar Armada', 'Scanner', 'Profil'];
                nestedRouteTitle.value = defaultTitles[index];
                _tabTitles[index] = defaultTitles[index];
                nestedRouteSubtitle.value = null; // Clear subtitle when at root of tab
              }
            });
          },
          letIndexChange: (index) => true,
        ),
      ),
    );
  }
}

class ShipListRoot extends StatefulWidget {
  final Widget child;
  const ShipListRoot({super.key, required this.child});

  @override
  State<ShipListRoot> createState() => _ShipListRootState();
}

class _ShipListRootState extends State<ShipListRoot>
    with RouteAware, TitleUpdater<ShipListRoot> {
  @override
  String? get pageTitle => null;

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}

class TabRoot extends StatefulWidget {
  final Widget child;
  final String title;
  const TabRoot({super.key, required this.child, required this.title});

  @override
  State<TabRoot> createState() => _TabRootState();
}

class _TabRootState extends State<TabRoot>
    with RouteAware, TitleUpdater<TabRoot> {
  @override
  String? get pageTitle => null;

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}
