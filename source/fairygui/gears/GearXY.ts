namespace fgui {
    export class GearXY extends GearBase {
        private _storage: Object;
        private _default: Laya.Point;

        constructor(owner: GObject) {
            super(owner);
        }

        protected init(): void {
            this._default = new Laya.Point(this._owner.x, this._owner.y);
            this._storage = {};
        }

        protected addStatus(pageId: string, buffer: ByteBuffer): void {
            var gv: Laya.Point;
            if (pageId == null)
                gv = this._default;
            else {
                gv = new Laya.Point();
                this._storage[pageId] = gv;
            }
            gv.x = buffer.getInt32();
            gv.y = buffer.getInt32();
        }

        public apply(): void {
            var pt: Laya.Point = this._storage[this._controller.selectedPageId];
            if (!pt)
                pt = this._default;

            if (this._tweenConfig != null && this._tweenConfig.tween && !UIPackage._constructing && !GearBase.disableAllTweenEffect) {
                if (this._tweenConfig._tweener != null) {
                    if (this._tweenConfig._tweener.endValue.x != pt.x || this._tweenConfig._tweener.endValue.y != pt.y) {
                        this._tweenConfig._tweener.kill(true);
                        this._tweenConfig._tweener = null;
                    }
                    else
                        return;
                }

                if (this._owner.x != pt.x || this._owner.y != pt.y) {
                    if (this._owner.checkGearController(0, this._controller))
                        this._tweenConfig._displayLockToken = this._owner.addDisplayLock();

                    this._tweenConfig._tweener = GTween.to2(this._owner.x, this._owner.y, pt.x, pt.y, this._tweenConfig.duration)
                        .setDelay(this._tweenConfig.delay)
                        .setEase(this._tweenConfig.easeType)
                        .setTarget(this)
                        .onUpdate(this.__tweenUpdate, this)
                        .onComplete(this.__tweenComplete, this);
                }
            }
            else {
                this._owner._gearLocked = true;
                this._owner.setXY(pt.x, pt.y);
                this._owner._gearLocked = false;
            }
        }

        private __tweenUpdate(tweener: GTweener): void {
            this._owner._gearLocked = true;
            this._owner.setXY(tweener.value.x, tweener.value.y);
            this._owner._gearLocked = false;
        }

        private __tweenComplete(): void {
            if (this._tweenConfig._displayLockToken != 0) {
                this._owner.releaseDisplayLock(this._tweenConfig._displayLockToken);
                this._tweenConfig._displayLockToken = 0;
            }
            this._tweenConfig._tweener = null;
        }

        public updateState(): void {
            var pt: Laya.Point = this._storage[this._controller.selectedPageId];
            if (!pt) {
                pt = new Laya.Point();
                this._storage[this._controller.selectedPageId] = pt;
            }

            pt.x = this._owner.x;
            pt.y = this._owner.y;
        }

        public updateFromRelations(dx: number, dy: number): void {
            if (this._controller == null || this._storage == null)
                return;

            for (var key in this._storage) {
                var pt: Laya.Point = this._storage[key];
                pt.x += dx;
                pt.y += dy;
            }
            this._default.x += dx;
            this._default.y += dy;

            this.updateState();
        }
    }
}