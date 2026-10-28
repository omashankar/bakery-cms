# Delivery map: free, with OpenStreetMap

At checkout the customer searches their area, then drags a pin on the map
onto their door. The **server** checks, before any order is priced:

1. **The pin is inside an active delivery area.** This check is required, is
   the shop's own code, and is always available.
2. **The PIN code and state at the pin agree with the address.** The PIN
   comes from India Post, not from the map. It is the PIN of the post offices
   nearest the pin, from India Post's own list of where each office stands.
   OpenStreetMap's Indian PINs are incomplete and sometimes wrong. On
   2026-10-27 it gave Sangod 325600, which no post office has, and Borkheda
   324001, where India Post says 324002. The state still comes from the map.

   | The PIN at the pin | What happens |
   |---|---|
   | The same as the address | Order goes through: "PIN matches" |
   | Close by, or in the **same district** | Order goes through, with a note on the order |
   | In **another district**, or another state | **Refused**: correct the PIN or move the pin |
   | None: no post office within ~30 km | Order goes through on the area check alone: "PIN not confirmed" |

   When the pin drops, checkout shows the address and "PIN code here". It
   fills the PIN, City and State boxes the customer left empty. Some spots sit
   where two PINs meet: there, the customer sees "Not your PIN?" with the
   nearby PINs to pick from. Search suggestions carry the same India Post
   PIN, and so does "Don't Know Pincode?" in the header.

   Measured on 14 known places (2026-10-28), the PIN was right everywhere in
   Kota and Sangod. In dense parts of Mumbai, Bengaluru and Kolkata it was
   sometimes the neighbouring PIN, which "Not your PIN?" offers.

PIN-code, district and state zones no longer decide delivery. Old ones are
marked "Decides nothing now": open each and draw its area. **Until at least
one area exists, no delivery order can be placed.**

## Nothing to sign up for

| Part | Service | Cost |
|---|---|---|
| Street map | Esri World Street Map, drawn with Leaflet. It names colonies (Talwandi, Vigyan Nagar), which OpenStreetMap's own tiles do not in Kota | Free, credited on the map |
| Address suggestions while typing | Photon (OpenStreetMap search) | Free, fair use |
| "Search for …" pressed (Hindi names, missed places) | Nominatim (OpenStreetMap geocoder), one request per press | Free, 1 request a second |
| A typed PIN code or "X district" | India Post's directory, in this app | Free, no service asked |
| PIN code at the pin | India Post's post office locations, in this app | Free |
| Address and state at the pin | Nominatim (OpenStreetMap geocoder) | Free |
| Inside the area or not | This app's own code | Free |

The only setting worth making is your email, which OpenStreetMap's usage
policy asks for:

```
MAP_CONTACT_EMAIL=you@yourshop.in
```

## Set up the delivery zones

Admin → Commerce → Delivery Zones → edit or add a zone → **This zone covers**:

- **On the map**: one or more areas, each a circle or a boundary:
  - **Circle**: search your shop, or press "I am at the shop". The circle
    starts at 5 km; drag its round edge handle, or type the km. The distance
    is a straight line, not by road.
  - **Boundary**: tap each corner in order around the area, and drag a corner
    to move it. You can also paste one `latitude, longitude` per line. A
    boundary that crosses itself is refused.
  - **+ Circle / + Boundary** adds another area to the same zone, so several
    mohallas at one price are one zone. Tap an area's chip to edit it; the
    others show dashed. ✕ removes one.
- **Whole districts**: pick districts from India Post's list. Every customer
  whose pin is in them is covered.
- **Whole states**: tick states. Every customer whose pin is in them is
  covered.

**Area by area** (Talwandi ₹40, Borkheda ₹60, the rest of Kota ₹80, the rest
of Rajasthan ₹150): make one zone per price. Areas that share a price go in
one zone, as several circles or boundaries. Where zones overlap, the
**narrowest** wins:

1. a circle or boundary (the smaller of two wins);
2. then a district;
3. then a state.

The **Delivery map** at the top of the zones page draws every live zone in
its own colour. Tap anywhere, or search a place, to see what a customer
there is told, from the same check checkout uses. Tap a zone's name below
the map to edit it.

A district or state zone needs to know where the pin is by name. The server
asks OpenStreetMap; when it cannot, the address's PIN decides, using India
Post's list. A pin inside a circle or boundary never needs to ask.

## When the shop gets busy

The free public services ask for fair use:

- the geocoder takes at most one request a second;
- the street map and Satellite view (Esri) are free for light use; a busy
  shop should create a free ArcGIS developer account.

This app keeps within those limits. It caches every answer, spaces its
geocoder calls a second apart, and never calls the geocoder for a pin outside
the areas. A small shop stays within them. A busy one should point these at
its own server, or at a hosted one (several have free tiers):

```
MAP_GEOCODER_URL=https://your-nominatim.example
MAP_SEARCH_URL=https://your-photon.example
NEXT_PUBLIC_MAP_TILE_URL=https://your-tiles.example/{z}/{x}/{y}.png
NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=&copy; OpenStreetMap contributors
```

`NEXT_PUBLIC_…` values are built into the page, so rebuild after changing
them.

### The Satellite view

Every map has a **Map | Satellite** switch. The photographs come from Esri's
World Imagery, with roads and place names drawn over them. They need no key,
and the map shows Esri's credit. Esri's terms allow this for light use. A busy
shop should create a free ArcGIS developer account, or point the view at
another imagery server:

```
NEXT_PUBLIC_MAP_SATELLITE_URL=https://your-imagery.example/{z}/{y}/{x}
NEXT_PUBLIC_MAP_SATELLITE_ATTRIBUTION=Imagery &copy; Your provider
```

### What every map offers

- **Map | Satellite**: the street map, or a photograph of the ground.
- **Show all**: the square button under the zoom buttons. It brings every
  delivery area back into view. In a zone's editor it shows that zone.
- **Full screen**: on computers and Android phones. iPhones allow only
  videos to go full screen, so the button is not shown there.
- **Scale**: bottom left, in km.
- **Mouse wheel**: zooms only after you click the map, so the page still
  scrolls past it.
- **Names on the map**: the admin's delivery map labels each zone with its
  name and charge. Checkout shades the areas and shows no names, because a
  zone's name is the owner's own word.

## Searching anywhere in India

The customer can search any place in India. The search is not limited to
the shop's delivery areas. Delivery is decided afterwards, on the server,
from the pin. Four sources answer, in this order:

1. **A PIN code** ("324005", "PIN 110001") or **a district** ("Kota
   district") is answered from India Post's directory, in this app.
2. **While typing**, Photon suggests places.
3. **"Search for …"** (or Enter) also asks Nominatim, once per press.
   Nominatim's rules forbid search-as-you-type, so it is never asked per
   keystroke. It finds Hindi names (जयपुर, कनॉट प्लेस, कोटा) and some places
   Photon misses ("Kota Junction").
4. **A town, district or state** chosen from the list moves the map there.
   It drops no pin and gets no PIN, because it covers many PINs. The
   customer then taps their door.

If the search services are down, the box says so. A PIN code still works,
from India Post. The customer can always drag the pin, tap the map, or use
their current location. If the street map's tiles fail before any has
loaded, the map switches to OpenStreetMap's own tiles
(`NEXT_PUBLIC_MAP_FALLBACK_TILE_URL` to choose another).

### Measured on 2026-10-28

36 searches across 20 states and union territories, through the shop's
own search:

- **Found, in English:** localities in Delhi, Mumbai, Bengaluru, Kolkata,
  Hyderabad, Lucknow, Patna, Kochi, Guwahati, Ludhiana, Indore,
  Bhubaneswar, Srinagar, Leh, Port Blair, Panaji and Gangtok. Also towns and
  villages: Sangod, Bithoor, Dholavira.
- **Hindi:** found only when Search is pressed: जयपुर, कनॉट प्लेस, कोटा.
  Not found: तलवंडी कोटा, because OpenStreetMap has no Hindi name for
  Talwandi.
- **Wrong place:** "T Nagar, Chennai" in the typed suggestions gives Shastri
  Nagar. Search pressed asks Nominatim, which knows Thiyagaraya Nagar.
- **Street-level map tiles (zoom 17):** present in all 14 places tried,
  from Delhi to Leh, Port Blair, Kohima and rural Bihar. Detail is thin in
  villages.
- **House numbers:** rarely found anywhere in India. The customer drags the
  pin to the door.

### What was not adopted

- **OpenFreeMap** serves vector tiles only. Its raster tiles came back
  empty. Vector tiles need MapLibre GL: 207 KB of JavaScript (gzip),
  against Leaflet's 42 KB, on the checkout page. A raster tile server is
  set with `NEXT_PUBLIC_MAP_TILE_URL` instead.
- **CARTO basemaps** now ask for an API key.

### Data fixed in India Post's directory

India Post files a few PINs under a district hundreds of km from their
offices. The build corrects a PIN only when its state disagrees with its
PIN block, its offices stand next to that block, and it is far from every
other PIN of its filed district. Three PINs were corrected:

| PIN | India Post says | Corrected to |
|---|---|---|
| 799001 (Agartala) | Nirmal, Telangana | West Tripura |
| 334002 | Raipur, Chhattisgarh | Bikaner, Rajasthan |
| 612906 | Kozhikode, Kerala | Ariyalur, Tamil Nadu |

Enclaves (Mahe) and border PINs are left as filed.

## Limits worth knowing

- The server cannot know where the customer really is. It can refuse a pin
  outside the areas, and an address the map contradicts.
- OpenStreetMap's search finds areas, streets and landmarks well, but rarely
  house numbers in India. That is why the customer drags the pin to the door
  themselves.
- The city is compared but never refuses. People write their tehsil town and
  the map its district, and both are right.
- Saved addresses do not keep a pin. The customer pins again at each
  checkout.
- The PIN shown at a pin is the nearest post office's. Checkout labels it
  that way. Where no office is near, it says it found none and asks the
  customer to check their own PIN. It never claims one.
- Checkout keeps three things apart. The pin is the coordinates and where
  they came from (this device ±metres, placed by you, from search). The
  map's address is what the map says is at the pin. The customer's address
  is what they typed.
- A computer's "current location" is a guess from its network, often
  kilometres out. It is drawn as a circle, with a warning.
- Location data: the order keeps its pin and the map's address, because
  delivery needs them. The browser keeps the customer's chosen place on
  their own device. The server keeps search answers in memory for an hour
  and address lookups for a day, never on disk. No coordinates are logged.

## Refreshing the PIN data

`npm run pincodes:update` downloads India Post's directory and rebuilds both
files: `india-pincodes.json` (each PIN's district, state and areas) and
`india-pincode-points.json` (where each PIN's post offices stand). Run it
every few months. Both files stay on the server and never reach a page.

## The browser must be allowed to share location

"Detect my location", checkout's "Use my current location" and the zone
editor's "I am at the shop" all ask the phone where it is. `next.config.ts`
allows this for the shop's own pages only (`geolocation=(self)`). Before
2026-10-28 it said `geolocation=()`, so the browser refused all three buttons
without asking.
