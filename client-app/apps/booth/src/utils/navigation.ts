// Safe back navigation. navigation.goBack() on the root of a stack raises
// "The action 'GO_BACK' was not handled by any navigator". This falls back to a
// known route instead.
export function goBackOr(
  navigation: { canGoBack(): boolean; goBack(): void },
  fallbackRoute: string,
): void {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  (navigation as unknown as { navigate: (route: string) => void }).navigate(fallbackRoute);
}
