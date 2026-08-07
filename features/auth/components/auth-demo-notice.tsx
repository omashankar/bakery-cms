export function AuthDemoNotice() {
  return (
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      {/*
        Not "6+": the server has never accepted six, and now wants mixed
        case and a digit as well. A sign-in hint that understates the rule
        sends someone to a refusal.
      */}
      Demo · any email · password 8+ with mixed case and a number
    </p>
  );
}
