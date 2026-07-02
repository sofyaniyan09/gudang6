import 'package:flutter/material.dart';

// Create a map of route observers, one for each tab's navigator
final Map<String, RouteObserver<PageRoute>> nestedRouteObservers = {
  'CC Penerimaan Material': RouteObserver<PageRoute>(),
  'Daftar Armada': RouteObserver<PageRoute>(),
  'Scanner': RouteObserver<PageRoute>(),
  'Profil': RouteObserver<PageRoute>(),
};

class TabObserverProvider extends InheritedWidget {
  final RouteObserver<PageRoute> observer;

  const TabObserverProvider({
    super.key,
    required this.observer,
    required super.child,
  });

  static RouteObserver<PageRoute>? of(BuildContext context) {
    final provider = context.dependOnInheritedWidgetOfExactType<TabObserverProvider>();
    return provider?.observer;
  }

  @override
  bool updateShouldNotify(TabObserverProvider oldWidget) => observer != oldWidget.observer;
}

final ValueNotifier<String?> nestedRouteTitle = ValueNotifier<String?>(null);
final ValueNotifier<String?> nestedRouteSubtitle = ValueNotifier<String?>(null);
final ValueNotifier<bool> globalSearchActive = ValueNotifier<bool>(false);
final ValueNotifier<int> globalSelectAllTrigger = ValueNotifier<int>(0);
final ValueNotifier<bool> globalIsAllSelected = ValueNotifier<bool>(false);

mixin TitleUpdater<T extends StatefulWidget> on State<T>, RouteAware {
  String? get pageTitle;
  String? get pageSubtitle => null;
  
  RouteObserver<PageRoute>? _observer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    _observer = TabObserverProvider.of(context);
    
    if (route is PageRoute && _observer != null) {
      _observer!.subscribe(this, route);
    }
  }

  @override
  void dispose() {
    if (_observer != null) {
      _observer!.unsubscribe(this);
    }
    super.dispose();
  }

  @override
  void didPush() {
    _updateTitle();
  }

  @override
  void didPopNext() {
    _updateTitle();
  }
  
  @override
  void didPop() {}

  void _updateTitle() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      nestedRouteTitle.value = pageTitle;
      nestedRouteSubtitle.value = pageSubtitle;
    });
  }
}
