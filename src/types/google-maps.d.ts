declare namespace google.maps {
  class Map {
    constructor(mapDiv: Element, opts?: MapOptions);
    setCenter(latlng: LatLng | LatLngLiteral): void;
    setZoom(zoom: number): void;
    getZoom(): number;
    getCenter(): LatLng;
    panTo(latlng: LatLng | LatLngLiteral): void;
    panBy(x: number, y: number): void;
    fitBounds(bounds: LatLngBounds | LatLngBoundsLiteral): void;
    addListener(eventName: string, handler: Function): MapsEventListener;
    setOptions(options: MapOptions): void;
  }

  interface MapOptions {
    center?: LatLng | LatLngLiteral;
    zoom?: number;
    mapTypeId?: MapTypeId;
    streetViewControl?: boolean;
    mapTypeControl?: boolean;
    fullscreenControl?: boolean;
    zoomControl?: boolean;
    styles?: MapTypeStyle[];
    backgroundColor?: string;
    clickableIcons?: boolean;
    disableDefaultUI?: boolean;
    draggable?: boolean;
    keyboardShortcuts?: boolean;
    scrollwheel?: boolean;
    tilt?: number;
  }

  class Marker {
    constructor(opts?: MarkerOptions);
    setMap(map: Map | null): void;
    getMap(): Map | null;
    setPosition(latlng: LatLng | LatLngLiteral): void;
    getPosition(): LatLng | null;
    setTitle(title: string): void;
    getTitle(): string | null;
    setLabel(label: string | MarkerLabel): void;
    getLabel(): string | MarkerLabel | null;
    addListener(eventName: string, handler: Function): MapsEventListener;
  }

  interface MarkerOptions {
    position: LatLng | LatLngLiteral;
    map?: Map | null;
    title?: string;
    label?: string | MarkerLabel;
    animation?: Animation;
    clickable?: boolean;
    draggable?: boolean;
    icon?: string | Icon | Symbol;
    opacity?: number;
    visible?: boolean;
    zIndex?: number;
  }

  class InfoWindow {
    constructor(opts?: InfoWindowOptions);
    setContent(content: string | Element): void;
    open(opts?: InfoWindowOpenOptions): void;
    close(): void;
  }

  interface InfoWindowOptions {
    content?: string | Element;
    position?: LatLng | LatLngLiteral;
    maxWidth?: number;
    pixelOffset?: Size;
    disableAutoPan?: boolean;
  }

  interface InfoWindowOpenOptions {
    anchor?: Marker;
    map?: Map;
  }

  interface MarkerLabel {
    text: string;
    color?: string;
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: string;
    className?: string;
  }

  class LatLng {
    constructor(lat: number, lng: number, noWrap?: boolean);
    lat(): number;
    lng(): number;
    toString(): string;
    toUrlValue(precision?: number): string;
    equals(other: LatLng): boolean;
  }

  interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  class LatLngBounds {
    constructor(sw?: LatLng | LatLngLiteral, ne?: LatLng | LatLngLiteral);
    getCenter(): LatLng;
    getNorthEast(): LatLng;
    getSouthWest(): LatLng;
    contains(latlng: LatLng | LatLngLiteral): boolean;
    extend(point: LatLng | LatLngLiteral): LatLngBounds;
    union(other: LatLngBounds): LatLngBounds;
    isEmpty(): boolean;
    toSpan(): LatLng;
    toString(): string;
    toUrlValue(precision?: number): string;
  }

  interface LatLngBoundsLiteral {
    east: number;
    north: number;
    south: number;
    west: number;
  }

  enum MapTypeId {
    ROADMAP = 'roadmap',
    SATELLITE = 'satellite',
    HYBRID = 'hybrid',
    TERRAIN = 'terrain',
  }

  enum Animation {
    BOUNCE = 1,
    DROP = 2,
  }

  interface Icon {
    url: string;
    anchor?: Point;
    origin?: Point;
    scaledSize?: Size;
    size?: Size;
  }

  interface Symbol {
    path: string | SymbolPath;
    fillColor?: string;
    fillOpacity?: number;
    scale?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
  }

  enum SymbolPath {
    CIRCLE = 0,
    FORWARD_CLOSED_ARROW = 1,
    FORWARD_OPEN_ARROW = 2,
    BACKWARD_CLOSED_ARROW = 3,
    BACKWARD_OPEN_ARROW = 4,
  }

  class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  class Size {
    constructor(width: number, height: number, widthUnit?: string, heightUnit?: string);
    width: number;
    height: number;
  }

  interface MapTypeStyle {
    elementType?: string;
    featureType?: string;
    stylers: MapTypeStyler[];
  }

  interface MapTypeStyler {
    color?: string;
    gamma?: number;
    hue?: string;
    lightness?: number;
    saturation?: number;
    visibility?: string;
    weight?: number;
  }

  interface MapsEventListener {
    remove(): void;
  }

  interface MapMouseEvent {
    latLng: LatLng | null;
    domEvent: MouseEvent;
  }

  class Polyline {
    constructor(opts?: PolylineOptions);
    setMap(map: Map | null): void;
    getMap(): Map | null;
    setPath(path: LatLng[] | LatLngLiteral[] | MVCArray<LatLng>): void;
    getPath(): MVCArray<LatLng>;
    setOptions(options: PolylineOptions): void;
    addListener(eventName: string, handler: Function): MapsEventListener;
  }

  interface PolylineOptions {
    path?: LatLng[] | LatLngLiteral[] | MVCArray<LatLng>;
    geodesic?: boolean;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    visible?: boolean;
    zIndex?: number;
    map?: Map | null;
    clickable?: boolean;
    editable?: boolean;
    draggable?: boolean;
    icons?: IconSequence[];
    [key: string]: any;
  }

  interface IconSequence {
    icon?: Symbol;
    offset?: string;
    repeat?: string;
  }

  class MVCArray<T> {
    constructor(array?: T[]);
    clear(): void;
    forEach(callback: (item: T, index: number) => void): void;
    getArray(): T[];
    getAt(i: number): T;
    getLength(): number;
    insertAt(i: number, elem: T): void;
    pop(): T;
    push(elem: T): number;
    removeAt(i: number): T;
    setAt(i: number, elem: T): void;
  }

  namespace places {
    class Autocomplete {
      constructor(input: HTMLInputElement, opts?: AutocompleteOptions);
      addListener(eventName: string, handler: Function): MapsEventListener;
      bindTo(bounds: LatLngBounds | LatLngBoundsLiteral): void;
      setBounds(bounds: LatLngBounds | LatLngBoundsLiteral): void;
      setComponentRestrictions(restrictions: ComponentRestrictions): void;
      setFields(fields: string[]): void;
      setOptions(options: AutocompleteOptions): void;
      setTypes(types: string[]): void;
    }

    interface AutocompleteOptions {
      bounds?: LatLngBounds | LatLngBoundsLiteral;
      componentRestrictions?: ComponentRestrictions;
      fields?: string[];
      placeIdOnly?: boolean;
      strictBounds?: boolean;
      types?: string[];
    }

    interface ComponentRestrictions {
      country: string | string[];
    }
  }
}

declare global {
  interface Window {
    google: typeof google;
    __gmapsScriptPromises?: Record<string, Promise<typeof google>>;
  }
}
