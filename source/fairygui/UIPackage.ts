namespace fgui {

    export class UIPackage {
        private _id: string;
        private _name: string;
        private _items: PackageItem[];
        private _itemsById: Object;
        private _itemsByName: Object;
        private _customId: string;
        private _sprites: Object;

        //public
        public static _constructing: number = 0;

        private static _instById: Object = {};
        private static _instByName: Object = {};

        constructor() {
            this._items = [];
            this._itemsById = {};
            this._itemsByName = {};
            this._sprites = {};
        }

        public static getById(id: string): UIPackage {
            return UIPackage._instById[id];
        }

        public static getByName(name: string): UIPackage {
            return UIPackage._instByName[name];
        }

        public static addPackage(resKey: string, descData?: ArrayBuffer): UIPackage {
            if (!descData) {
                descData = AssetProxy.inst.getRes(resKey + "." + UIConfig.packageFileExtension);
                if (!descData || descData.byteLength == 0)
                    throw new Error("namespace sunnyboxs not ready: " + resKey);
            }

            var buffer: ByteBuffer = new ByteBuffer(descData);

            var pkg: UIPackage = new UIPackage();
            pkg.loadPackage(buffer, resKey);
            UIPackage._instById[pkg.id] = pkg;
            UIPackage._instByName[pkg.name] = pkg;
            pkg._customId = resKey;
            return pkg;
        }

        public static loadPackage(resKey: string, completeHandler:Laya.Handler): void {
            let url: string = resKey + "." + UIConfig.packageFileExtension;

            var descCompleteHandler: Laya.Handler = Laya.Handler.create(this, function (asset) {
                let pkg: UIPackage = new UIPackage();
                pkg.loadPackage(new ByteBuffer(asset), resKey);
                let cnt: number = pkg._items.length;
                let urls = [];
                for (var i: number = 0; i < cnt; i++) {
                    var pi: PackageItem = pkg._items[i];
                    if (pi.type == PackageItemType.Atlas)
                        urls.push({ url: pi.file, type: Laya.Loader.IMAGE });
                    else if (pi.type == PackageItemType.Sound)
                        urls.push({ url: pi.file, type: Laya.Loader.SOUND });
                }

                if(urls.length>0)
                {
                    AssetProxy.inst.load(urls, Laya.Handler.create(this, function (): void {
                        UIPackage._instById[pkg.id] = pkg;
                        UIPackage._instByName[pkg.name] = pkg;

                        completeHandler.run();
                    }));
                }
                else
                    completeHandler.run();
            });

            AssetProxy.inst.load(url, descCompleteHandler, null, Laya.Loader.BUFFER);
        }

        public static removePackage(packageIdOrName: string): void {
            var pkg: UIPackage = UIPackage._instById[packageIdOrName];
            if (!pkg)
                pkg = UIPackage._instByName[packageIdOrName];
            if (!pkg)
                throw new Error("unknown package: " + packageIdOrName);

            pkg.dispose();
            delete UIPackage._instById[pkg.id];
            if (pkg._customId != null)
                delete UIPackage._instById[pkg._customId];
            delete UIPackage._instByName[pkg.name];
        }

        public static createObject(pkgName: string, resName: string, userClass?: any): GObject {
            var pkg: UIPackage = UIPackage.getByName(pkgName);
            if (pkg)
                return pkg.createObject(resName, userClass);
            else
                return null;
        }

        public static createObjectFromURL(url: string, userClass?: any): GObject {
            var pi: PackageItem = UIPackage.getItemByURL(url);
            if (pi)
                return pi.owner.internalCreateObject(pi, userClass);
            else
                return null;
        }

        public static getItemURL(pkgName: string, resName: string): string {
            var pkg: UIPackage = UIPackage.getByName(pkgName);
            if (!pkg)
                return null;

            var pi: PackageItem = pkg._itemsByName[resName];
            if (!pi)
                return null;

            return "ui://" + pkg.id + pi.id;
        }

        public static getItemByURL(url: string): PackageItem {
            var pos1: number = url.indexOf("//");
            if (pos1 == -1)
                return null;

            var pos2: number = url.indexOf("/", pos1 + 2);
            if (pos2 == -1) {
                if (url.length > 13) {
                    var pkgId: string = url.substr(5, 8);
                    var pkg: UIPackage = UIPackage.getById(pkgId);
                    if (pkg != null) {
                        var srcId: string = url.substr(13);
                        return pkg.getItemById(srcId);
                    }
                }
            }
            else {
                var pkgName: string = url.substr(pos1 + 2, pos2 - pos1 - 2);
                pkg = UIPackage.getByName(pkgName);
                if (pkg != null) {
                    var srcName: string = url.substr(pos2 + 1);
                    return pkg.getItemByName(srcName);
                }
            }

            return null;
        }

        public static getItemAssetByURL(url: string): Object {
            var item: PackageItem = UIPackage.getItemByURL(url);
            if (item == null)
                return null;

            return item.owner.getItemAsset(item);
        }

        public static normalizeURL(url: string): string {
            if (url == null)
                return null;

            var pos1: number = url.indexOf("//");
            if (pos1 == -1)
                return null;

            var pos2: number = url.indexOf("/", pos1 + 2);
            if (pos2 == -1)
                return url;

            var pkgName: string = url.substr(pos1 + 2, pos2 - pos1 - 2);
            var srcName: string = url.substr(pos2 + 1);
            return UIPackage.getItemURL(pkgName, srcName);
        }

        public static setStringsSource(source: string): void {
            TranslationHelper.loadFromXML(source);
        }

        private loadPackage(buffer: ByteBuffer, resKey: string): void {
            if (buffer.getUint32() != 0x46475549)
                throw new Error("FairyGUI: old namespace sunnyboxs found in '" + resKey + "'");

            buffer.version = buffer.getInt32();
            var compressed: boolean = buffer.readBool();
            this._id = buffer.readUTFString();
            this._name = buffer.readUTFString();
            buffer.skip(20);

            if (compressed) {
                var buf: Uint8Array = new Uint8Array(buffer.buffer, buffer.pos, buffer.length - buffer.pos);
                var inflater = new Zlib.RawInflate(buf);
                buf = inflater.decompress();

                buffer = new ByteBuffer(buf);
            }

            var indexTablePos: number = buffer.pos;
            var cnt: number;
            var i: number;
            var nextPos: number;

            buffer.seek(indexTablePos, 4);

            cnt = buffer.getInt32();
            var stringTable: string[] = [];
            for (i = 0; i < cnt; i++)
                stringTable[i] = buffer.readUTFString();
            buffer.stringTable = stringTable;

            buffer.seek(indexTablePos, 1);

            var pi: PackageItem;
            resKey = resKey + "_";

            cnt = buffer.getUint16();
            for (i = 0; i < cnt; i++) {
                nextPos = buffer.getInt32();
                nextPos += buffer.pos;

                pi = new PackageItem();
                pi.owner = this;
                pi.type = buffer.readByte();
                pi.id = buffer.readS();
                pi.name = buffer.readS();
                buffer.readS(); //path
                pi.file = buffer.readS();
                buffer.readBool();//exported
                pi.width = buffer.getInt32();
                pi.height = buffer.getInt32();

                switch (pi.type) {
                    case PackageItemType.Image:
                        {
                            pi.objectType = ObjectType.Image;
                            var scaleOption: number = buffer.readByte();
                            if (scaleOption == 1) {
                                pi.scale9Grid = new Laya.Rectangle();
                                pi.scale9Grid.x = buffer.getInt32();
                                pi.scale9Grid.y = buffer.getInt32();
                                pi.scale9Grid.width = buffer.getInt32();
                                pi.scale9Grid.height = buffer.getInt32();

                                pi.tileGridIndice = buffer.getInt32();
                            }
                            else if (scaleOption == 2)
                                pi.scaleByTile = true;

                            pi.smoothing = buffer.readBool();
                            break;
                        }

                    case PackageItemType.MovieClip:
                        {
                            pi.smoothing = buffer.readBool();
                            pi.objectType = ObjectType.MovieClip;
                            pi.rawData = buffer.readBuffer();
                            break;
                        }

                    case PackageItemType.Font:
                        {
                            pi.rawData = buffer.readBuffer();
                            break;
                        }

                    case PackageItemType.Component:
                        {
                            var extension: number = buffer.readByte();
                            if (extension > 0)
                                pi.objectType = extension;
                            else
                                pi.objectType = ObjectType.Component;
                            pi.rawData = buffer.readBuffer();

                            UIObjectFactory.resolvePackageItemExtension(pi);
                            break;
                        }

                    case PackageItemType.Atlas:
                    case PackageItemType.Sound:
                    case PackageItemType.Misc:
                        {
                            pi.file = resKey + pi.file;
                            break;
                        }
                }
                this._items.push(pi);
                this._itemsById[pi.id] = pi;
                if (pi.name != null)
                    this._itemsByName[pi.name] = pi;

                buffer.pos = nextPos;
            }

            buffer.seek(indexTablePos, 2);

            cnt = buffer.getUint16();
            for (i = 0; i < cnt; i++) {
                nextPos = buffer.getUint16();
                nextPos += buffer.pos;

                var itemId: string = buffer.readS();
                pi = this._itemsById[buffer.readS()];

                var sprite: AtlasSprite = new AtlasSprite();
                sprite.atlas = pi;
                sprite.rect.x = buffer.getInt32();
                sprite.rect.y = buffer.getInt32();
                sprite.rect.width = buffer.getInt32();
                sprite.rect.height = buffer.getInt32();
                sprite.rotated = buffer.readBool();
                this._sprites[itemId] = sprite;

                buffer.pos = nextPos;
            }

            if (buffer.seek(indexTablePos, 3)) {
                cnt = buffer.getUint16();
                for (i = 0; i < cnt; i++) {
                    nextPos = buffer.getInt32();
                    nextPos += buffer.pos;

                    pi = this._itemsById[buffer.readS()];
                    if (pi && pi.type == PackageItemType.Image) {
                        pi.pixelHitTestData = new PixelHitTestData();
                        pi.pixelHitTestData.load(buffer);
                    }

                    buffer.pos = nextPos;
                }
            }
        }

        public loadAllAssets(): void {
            var cnt: number = this._items.length;
            for (var i: number = 0; i < cnt; i++) {
                var pi: PackageItem = this._items[i];
                this.getItemAsset(pi);
            }
        }

        public unloadAssets(): void {
            var cnt: number = this._items.length;
            for (var i: number = 0; i < cnt; i++) {
                var pi: PackageItem = this._items[i];
                if (pi.type == PackageItemType.Atlas) {
                    if (pi.texture != null)
                        Laya.loader.clearTextureRes(pi.texture.url);
                }
            }
        }

        public dispose(): void {
            var cnt: number = this._items.length;
            for (var i: number = 0; i < cnt; i++) {
                var pi: PackageItem = this._items[i];
                if (pi.type == PackageItemType.Atlas) {
                    if (pi.texture != null) {
                        pi.texture.destroy();
                        pi.texture = null;
                    }
                }
                else if (pi.type == PackageItemType.Sound) {
                    Laya.SoundManager.destroySound(pi.file);
                }
            }
        }

        public get id(): string {
            return this._id;
        }

        public get name(): string {
            return this._name;
        }

        public get customId(): string {
            return this._customId;
        }

        public set customId(value: string) {
            if (this._customId != null)
                delete UIPackage._instById[this._customId];
            this._customId = value;
            if (this._customId != null)
                UIPackage._instById[this._customId] = this;
        }

        public createObject(resName: string, userClass?: any): GObject {
            var pi: PackageItem = this._itemsByName[resName];
            if (pi)
                return this.internalCreateObject(pi, userClass);
            else
                return null;
        }

        public internalCreateObject(item: PackageItem, userClass?: any): GObject {
            var g: GObject;
            if (item.type == PackageItemType.Component) {
                if (userClass)
                    g = new userClass();
                else
                    g = UIObjectFactory.newObject(item);
            }
            else
                g = UIObjectFactory.newObject(item);

            if (g == null)
                return null;

            UIPackage._constructing++;
            g.packageItem = item;
            g.constructFromResource();
            UIPackage._constructing--;
            return g;
        }

        public getItemById(itemId: string): PackageItem {
            return this._itemsById[itemId];
        }

        public getItemByName(resName: string): PackageItem {
            return this._itemsByName[resName];
        }

        public getItemAssetByName(resName: string): Object {
            var pi: PackageItem = this._itemsByName[resName];
            if (pi == null) {
                throw "Resource not found -" + resName;
            }

            return this.getItemAsset(pi);
        }

        public getItemAsset(item: PackageItem): Object {
            switch (item.type) {
                case PackageItemType.Image:
                    if (!item.decoded) {
                        item.decoded = true;
                        var sprite: AtlasSprite = this._sprites[item.id];
                        if (sprite != null) {
                            var atlasTexture: Laya.Texture = <Laya.Texture>(this.getItemAsset(sprite.atlas));
                            item.texture = Laya.Texture.create(atlasTexture,
                                sprite.rect.x, sprite.rect.y, sprite.rect.width, sprite.rect.height);
                        }
                        else
                            item.texture = null;
                    }
                    return item.texture;

                case PackageItemType.Atlas:
                    if (!item.decoded) {
                        item.decoded = true;
                        item.texture = AssetProxy.inst.getRes(item.file);
                        //if(!fgui.UIConfig.textureLinearSampling)
                        //item.texture.isLinearSampling = false;
                    }
                    return item.texture;

                case PackageItemType.Font:
                    if (!item.decoded) {
                        item.decoded = true;
                        this.loadFont(item);
                    }
                    return item.bitmapFont;

                case PackageItemType.MovieClip:
                    if (!item.decoded) {
                        item.decoded = true;
                        this.loadMovieClip(item);
                    }
                    return item.frames;

                case PackageItemType.Component:
                    return item.rawData;

                case PackageItemType.Misc:
                    if (item.file)
                        return AssetProxy.inst.getRes(item.file);
                    else
                        return null;

                default:
                    return null;
            }
        }

        private loadMovieClip(item: PackageItem): void {
            var buffer: ByteBuffer = item.rawData;

            buffer.seek(0, 0);

            item.interval = buffer.getInt32();
            item.swing = buffer.readBool();
            item.repeatDelay = buffer.getInt32();

            buffer.seek(0, 1);

            var frameCount: number = buffer.getInt16();
            item.frames = [];

            var spriteId: string;
            var frame: Frame;
            var sprite: AtlasSprite;
            var fx: number;
            var fy: number;

            for (var i: number = 0; i < frameCount; i++) {
                var nextPos: number = buffer.getInt16();
                nextPos += buffer.pos;

                frame = new Frame();
                fx = buffer.getInt32();
                fy = buffer.getInt32();
                buffer.getInt32(); //width
                buffer.getInt32(); //height
                frame.addDelay = buffer.getInt32();
                spriteId = buffer.readS();

                if (spriteId != null && (sprite = this._sprites[spriteId]) != null) {
                    var atlasTexture: Laya.Texture = <Laya.Texture>(this.getItemAsset(sprite.atlas));
                    frame.texture = Laya.Texture.create(atlasTexture,
                        sprite.rect.x, sprite.rect.y, sprite.rect.width, sprite.rect.height,
                        fx, fy, item.width, item.height);
                }
                item.frames[i] = frame;

                buffer.pos = nextPos;
            }
        }

        private loadFont(item: PackageItem): void {
            var font: BitmapFont = new BitmapFont();
            item.bitmapFont = font;
            var buffer: ByteBuffer = item.rawData;

            buffer.seek(0, 0);

            font.ttf = buffer.readBool();
            buffer.readBool(); //tint
            font.resizable = buffer.readBool();
            buffer.readBool(); //has channel
            font.size = buffer.getInt32();
            var xadvance: number = buffer.getInt32();
            var lineHeight: number = buffer.getInt32();

            var mainTexture: Laya.Texture = null;
            var mainSprite: AtlasSprite = this._sprites[item.id];
            if (mainSprite != null)
                mainTexture = <Laya.Texture>(this.getItemAsset(mainSprite.atlas));

            buffer.seek(0, 1);

            var bg: BMGlyph = null;
            var cnt: number = buffer.getInt32();
            for (var i: number = 0; i < cnt; i++) {
                var nextPos: number = buffer.getInt16();
                nextPos += buffer.pos;

                bg = new BMGlyph();
                var ch: string = buffer.readChar();
                font.glyphs[ch] = bg;

                var img: string = buffer.readS();
                var bx: number = buffer.getInt32();
                var by: number = buffer.getInt32();
                bg.offsetX = buffer.getInt32();
                bg.offsetY = buffer.getInt32();
                bg.width = buffer.getInt32();
                bg.height = buffer.getInt32();
                bg.advance = buffer.getInt32();
                bg.channel = buffer.readByte();
                if (bg.channel == 1)
                    bg.channel = 3;
                else if (bg.channel == 2)
                    bg.channel = 2;
                else if (bg.channel == 3)
                    bg.channel = 1;

                if (!font.ttf) {
                    var charImg: PackageItem = this._itemsById[img];
                    if (charImg) {
                        this.getItemAsset(charImg);
                        bg.width = charImg.width;
                        bg.height = charImg.height;
                        bg.texture = charImg.texture;
                    }
                }
                else {
                    bg.texture = Laya.Texture.create(mainTexture,
                        bx + mainSprite.rect.x, by + mainSprite.rect.y, bg.width, bg.height);
                }

                if (font.ttf)
                    bg.lineHeight = lineHeight;
                else {
                    if (bg.advance == 0) {
                        if (xadvance == 0)
                            bg.advance = bg.offsetX + bg.width;
                        else
                            bg.advance = xadvance;
                    }

                    bg.lineHeight = bg.offsetY < 0 ? bg.height : (bg.offsetY + bg.height);
                    if (bg.lineHeight < font.size)
                        bg.lineHeight = font.size;
                }

                buffer.pos = nextPos;
            }
        }
    }


    class AtlasSprite {
        public atlas: PackageItem;
        public rect: Laya.Rectangle;
        public rotated: boolean;

        constructor() {
            this.rect = new Laya.Rectangle();
        }
    }
}