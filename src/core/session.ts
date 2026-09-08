// @spec WORKSHEET-017, SCANNER-005, SCANNER-009, SCANNER-010, SCANNER-019, SCANNER-027, SCANNER-029, SCANNER-030
export class ScanSession {
  photoRevision = 0;
  drawingRevision = 0;
  private request = 0;
  private acknowledgment = -1;
  beginRequest() {
    return ++this.request;
  }
  isCurrent(id: number) {
    return this.request === id;
  }
  beginReplacement() {
    this.request++;
  }
  commitPhoto() {
    this.photoRevision++;
    this.changeGeometry();
  }
  changeGeometry() {
    this.drawingRevision++;
    this.request++;
    this.acknowledgment = -1;
  }
  acknowledge() {
    this.acknowledgment = this.drawingRevision;
  }
  get acknowledged() {
    return this.acknowledgment === this.drawingRevision;
  }
}
