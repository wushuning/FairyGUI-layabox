namespace fgui {
    export class GImage extends GObject {
        public image: Image;

        private _flip: number;

        constructor() {
            super();
        }

        public get color(): string {
            return this.image.color;
        }

        public set color(value: string) {
            if (this.image.color != value) {
                this.image.color = value;
                this.updateGear(4);
            }
        }

        /**
         * @see FlipType
         */
        public get flip(): number {
            return this._flip;
        }

        /**
         * @see FlipType
         */
        public set flip(value: number) {
            if (this._flip != value) {
                this._flip = value;

                var sx: number = 1, sy: number = 1;
                if (this._flip == FlipType.Horizontal || this._flip == FlipType.Both)
                    sx = -1;
                if (this._flip == FlipType.Vertical || this._flip == FlipType.Both)
                    sy = -1;
                this.setScale(sx, sy);
                this.handleXYChanged();
            }
        }

        public get fillMethod(): number {
            return this.image.fillMethod;
        }

        public set fillMethod(value: number) {
            this.image.fillMethod = value;
        }

        public get fillOrigin(): number {
            return this.image.fillOrigin;
        }

        public set fillOrigin(value: number) {
            this.image.fillOrigin = value;
        }

        public get fillClockwise(): boolean {
            return this.image.fillClockwise;
        }

        public set fillClockwise(value: boolean) {
            this.image.fillClockwise = value;
        }

        public get fillAmount(): number {
            return this.image.fillAmount;
        }

        public set fillAmount(value: number) {
            this.image.fillAmount = value;
        }

        protected createDisplayObject(): void {
            this._displayObject = this.image = new Image();
            this.image.mouseEnabled = false;
            this._displayObject["$owner"] = this;
        }

        public constructFromResource(): void {
            this.packageItem.load();

            this.sourceWidth = this.packageItem.width;
            this.sourceHeight = this.packageItem.height;
            this.initWidth = this.sourceWidth;
            this.initHeight = this.sourceHeight;
            this.image.scale9Grid = this.packageItem.scale9Grid;
            this.image.scaleByTile = this.packageItem.scaleByTile;
            this.image.tileGridIndice = this.packageItem.tileGridIndice;
            this.image.texture = this.packageItem.texture;
            this.setSize(this.sourceWidth, this.sourceHeight);
        }

        protected handleXYChanged(): void {
            super.handleXYChanged();

            if (this._flip != FlipType.None) {
                if (this.scaleX == -1)
                    this.image.x += this.width;
                if (this.scaleY == -1)
                    this.image.y += this.height;
            }
        }

        public getProp(index: number): any {
            if (index == ObjectPropID.Color)
                return this.color;
            else
                return super.getProp(index);
        }

        public setProp(index: number, value: any): void {
            if (index == ObjectPropID.Color)
                this.color = value;
            else
                super.setProp(index, value);
        }

        public setup_beforeAdd(buffer: ByteBuffer, beginPos: number): void {
            super.setup_beforeAdd(buffer, beginPos);

            buffer.seek(beginPos, 5);

            if (buffer.readBool())
                this.color = buffer.readColorS();
            this.flip = buffer.readByte();
            this.image.fillMethod = buffer.readByte();
            if (this.image.fillMethod != 0) {
                this.image.fillOrigin = buffer.readByte();
                this.image.fillClockwise = buffer.readBool();
                this.image.fillAmount = buffer.getFloat32();
            }
        }
    }

}