///<reference path="ControllerAction.ts"/>

namespace fgui {
    export class ChangePageAction extends ControllerAction {
        public objectId: string;
        public controllerName: string;
        public targetPage: string;

        constructor() {
            super();
        }

        protected enter(controller: Controller): void {
            if (!this.controllerName)
                return;

            var gcom: GComponent;
            if (this.objectId)
                gcom = controller.parent.getChildById(this.objectId) as GComponent;
            else
                gcom = controller.parent;
            if (gcom) {
                var cc: Controller = gcom.getController(this.controllerName);
                if (cc && cc != controller && !cc.changing)
                    cc.selectedPageId = this.targetPage;
            }
        }

        public setup(buffer: ByteBuffer): void {
            super.setup(buffer);

            this.objectId = buffer.readS();
            this.controllerName = buffer.readS();
            this.targetPage = buffer.readS();
        }
    }

}