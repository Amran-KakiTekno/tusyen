import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:eduapp/main.dart';

void main() {
  testWidgets('shows the Tusyen sign in screen', (WidgetTester tester) async {
    FlutterSecureStorage.setMockInitialValues({});

    await tester.pumpWidget(const TusyenApp());
    await tester.pumpAndSettle();

    expect(find.text('Start learning'), findsOneWidget);
  });
}
