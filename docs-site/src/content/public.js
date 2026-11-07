export const publicPages = [
  {
    id: 'happypix-101', group: 'HappyPix 101', title: 'Welcome to HappyPix', icon: '✳',
    description: 'A friendly field guide for the people who run events, booths and the business behind them.',
    read: '3 min', tags: ['Start here', 'Clients', 'Field guide'],
    sections: [
      { title: 'A little more magic in the room', text: 'HappyPix brings the photo-booth moment, instant prints and shareable galleries together with the tools that help an event team run smoothly.' },
      { title: 'What HappyPix helps you do', cards: [
        { title: 'Make the moment', text: 'The booth guides guests from welcome screen to camera, layout, print and digital sharing.' },
        { title: 'Run the business', text: 'The CRM helps your team organise events, manage booth devices and keep an eye on activity.' },
        { title: 'Keep it connected', text: 'The camera, printer and booth device work as a team. These pages help you choose a setup and get it ready.' },
      ] },
      { title: 'Our vision', text: 'Make event photography joyful for guests and practical for the people behind the booth—whether you are starting with one tablet or running a growing fleet.' },
      { title: 'How to use this guide', text: 'Choose a section from the left. Use the platform and setup chips to narrow instructions to your gear. Follow the numbered steps in order; when something is device-specific, the guide calls it out.' },
    ],
  },
  {
    id: 'booth-101', group: 'Booth 101', title: 'The booth, from hello to print', icon: '▣',
    description: 'A short tour of the guest flow. Choose the device you are setting up to see the useful differences.',
    read: '6 min', tags: ['Android', 'iPad', 'Windows'], interactive: 'booth',
  },
  {
    id: 'crm-101', group: 'CRM 101', title: 'Your HappyPix workspace', icon: '▤',
    description: 'The organisation workspace is where owners and teams prepare events and look after their booth operation.',
    read: '5 min', tags: ['Organisation', 'Events', 'Devices'],
    sections: [
      { title: 'Start with your organisation', text: 'Your workspace belongs to your organisation. Invite teammates with the role that matches the work they need to do, and keep platform-level administration with HappyPix.' },
      { title: 'The everyday loop', cards: [
        { title: '1 · Prepare an event', text: 'Create the event, add its date and details, and choose the photo experience and print options your plan makes available.' },
        { title: '2 · Connect a booth', text: 'Pair the booth device with your organisation and event. Confirm the booth is online before guests arrive.' },
        { title: '3 · Review and follow up', text: 'Use event and device views to check activity. Review session, gallery and payment information when it is available to your role.' },
      ] },
      { title: 'People and permissions', text: 'Organisation Admins manage the organisation and its team. Organisation Managers can handle day-to-day event and device tasks. Your available actions depend on your assigned role and plan.' },
      { title: 'If something does not look right', bullets: ['Check that you are in the right organisation and event.', 'Confirm your role allows the action; ask your organisation admin if an action is missing.', 'For a booth that is offline, check power, Wi-Fi and pairing before changing the event.', 'Use the contact form below if you still need a hand.'] },
    ],
  },
  {
    id: 'make-it-run', group: 'Make it run', title: 'Build your booth setup', icon: '⌁',
    description: 'Choose a booth host, camera path and printer path. Then follow the wiring and event-day checklist.',
    read: '8 min', tags: ['Hardware', 'Wi-Fi', 'Compatibility'], interactive: 'setup',
  },
];

export const boothGuides = {
  Android: {
    intro: 'The Android booth is a React Native app that runs on a supported tablet. The tablet can use its own camera, a compatible Canon CCAPI camera over Wi-Fi, limited USB-OTG PTP capture, or a Windows Electron bridge for supported Nikon gear.',
    steps: [
      ['Pair the booth', 'Sign in to the booth using the organisation credentials, then choose the organisation and event it should serve. Keep pairing details private.'],
      ['Welcome guests', 'The welcome screen shows the event experience and starts a new guest session. The operator can confirm the event and return to this screen between groups.'],
      ['Capture frames', 'Guests follow the on-screen countdown and capture prompts. Use the tablet camera for the simplest setup, or connect the external camera path before opening the booth.'],
      ['Choose a layout', 'Pick an available frame/layout, then review the selected shots. Layout availability depends on the event and plan.'],
      ['Customise and print', 'Apply the options shown in the booth, confirm print quantity, then follow payment or free-event prompts if enabled.'],
      ['Share the result', 'After the session, guests can use the QR/download experience when it is enabled and connectivity is available.'],
    ],
    note: 'An external camera or printer may use the same trusted Wi-Fi network or a Windows bridge. The app does not automatically find every address on a busy LAN; confirm the exact connection during setup.',
    screenshot: 'android-start.png',
  },
  iPad: {
    intro: 'iPad is a first-class booth platform using the shared React Native app. The iPad screen is the guest-facing kiosk; use the same guest flow as Android, with iPad-specific camera, local-network and print checks.',
    steps: [
      ['Pair the booth', 'Sign in and pair the iPad with the organisation and event. Grant the requested camera and local-network permissions.'],
      ['Welcome guests', 'The start screen introduces the event. Tap the start action to begin a guest session; return here when the group is finished.'],
      ['Capture frames', 'Use the built-in iPad camera for the least complicated path. Canon CCAPI and Nikon-over-Windows-bridge paths need real-device LAN testing before an event.'],
      ['Choose and review', 'Select an available layout, review the captured frames, and continue to the customisation step when it is offered.'],
      ['Print or share', 'For reliable prints, route to the Windows Electron Print Bridge. AirPrint may open an iOS print interaction and is not a validated unattended kiosk path.'],
    ],
    note: 'The iPad booth UI follows the shared React Native flow. Electron is the source of truth for the desktop kiosk UI/design/logic, but hardware connections, permissions and some print actions differ by platform.',
    screenshot: 'ipad-start.png',
  },
  Windows: {
    intro: 'The Windows booth runs in Electron and is the source of truth for kiosk UI, design and guest-flow logic. It is also the best host for a Windows printer queue and supported Nikon Remote SDK cameras.',
    steps: [
      ['Prepare the PC', 'Install the booth app, connect the guest-facing display and sign in. For a separate kiosk display, connect it before launching the packaged app.'],
      ['Connect camera and printer', 'Install the camera SDK/driver as required. Add the photo printer in Windows and print a test before opening the guest flow.'],
      ['Start the event', 'Choose the event and check camera, printer and bridge status. Electron launches the booth window in kiosk mode for packaged builds.'],
      ['Guide each guest', 'Guests follow the welcome, countdown, capture, layout, review, customisation, print and share prompts. Exact steps can vary with event settings.'],
      ['Keep a tablet in sync', 'Android or iPad companion booths can use the Windows Print Bridge on the trusted LAN. For Nikon bridge use, check that host and tablet can reach one another.'],
    ],
    note: 'Electron shares the product flow, not identical hardware APIs on every OS. Nikon Remote SDK integration is Windows-only; Electron Canon currently probes/triggers but does not retrieve the camera file into the session. Verify the actual captured image before production use.',
    screenshot: 'windows-kiosk.png',
  },
};

export const setupChoices = {
  host: ['Android tablet', 'iPad', 'Windows PC'],
  camera: ['Built-in camera', 'Canon CCAPI over Wi-Fi', 'Nikon Remote SDK', 'USB PTP (Android only)', 'USB webcam'],
  printer: ['Windows Print Bridge', 'Network IPP', 'AirPrint (iPad)', 'Windows / macOS print queue'],
};

export const compatibility = [
  { device: 'Built-in phone/tablet camera', android: 'Supported', ipad: 'Supported', windows: '—', detail: 'React Native device camera; grant camera permission.' },
  { device: 'USB UVC webcam / PC camera', android: '—', ipad: '—', windows: 'Supported', detail: 'Electron uses the host camera APIs and operating-system device access.' },
  { device: 'Canon CCAPI camera', android: 'Provider path', ipad: 'Provider path · test ATS', windows: 'Probe/trigger only', detail: 'RN provider has image retrieval. Electron currently does not transfer the DSLR file into the booth session. Candidate bodies: EOS R5, R6, R7, R8, R10, R50, R100, 90D, 850D/T8i, PowerShot G7 X III and G5 X II. Candidate list is not certification; verify model, firmware and event Wi-Fi.' },
  { device: 'Nikon Remote SDK camera', android: 'Via Windows bridge', ipad: 'Via Windows bridge · test LAN', windows: 'USB + SDK', detail: 'Electron Windows host supports live view/capture/transfer for SDK-compatible bodies. No repository-certified model list; validate the exact camera and SDK.' },
  { device: 'USB PTP camera', android: 'Limited capture', ipad: 'Not supported', windows: '—', detail: 'Android OTG PTP capture and JPEG retrieval only; no live view/settings in this provider. Body-specific compatibility.' },
  { device: 'Sony Alpha tethering', android: 'Not complete', ipad: 'Not complete', windows: 'Not complete', detail: 'Sony provider is a stub. A generic webcam connection is a separate camera path.' },
  { device: 'DNP DS620A / DS-RX1HS / QW410', android: 'Via Windows bridge', ipad: 'Via Windows bridge', windows: 'OS driver / bridge', detail: 'Named as intended print-bridge examples. Not a physical certification or direct DNP SDK integration.' },
  { device: 'Other OS printer queue', android: 'Via Windows bridge', ipad: 'Via Windows bridge', windows: 'Windows spooler', detail: 'Install the manufacturer driver and confirm paper size, borderless, color and cut settings on the host.' },
  { device: 'IPP network printer', android: 'Provider path', ipad: 'Provider path', windows: 'OS queue', detail: 'Manual printer IP may be required; it does not scan the whole venue subnet.' },
  { device: 'AirPrint printer', android: '—', ipad: 'Print UI path', windows: '—', detail: 'iPad print interaction is operator-mediated and is not a validated unattended booth flow.' },
];
