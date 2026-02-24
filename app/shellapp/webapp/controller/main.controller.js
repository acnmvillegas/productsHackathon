sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/export/Spreadsheet",
  "sap/ui/export/library",
  "sap/m/Dialog",
  "sap/m/Button",
  "sap/m/VBox",
  "sap/m/HBox",
  "sap/m/Title",
  "sap/m/Text",
  "sap/m/ObjectStatus",
  "sap/m/ProgressIndicator",
  "sap/ui/Device"
], function (
  Controller,
  JSONModel,
  Filter,
  FilterOperator,
  MessageToast,
  MessageBox,
  Spreadsheet,
  exportLibrary,
  Dialog,
  Button,
  VBox,
  HBox,
  Title,
  Text,
  ObjectStatus,
  ProgressIndicator,
  Device
) {
  "use strict";

  const EdmType = exportLibrary.EdmType;

  return Controller.extend("hackathon.shellapp.controller.main", {

    onInit: function () {
      // Filters model (Selection fields)
      const oFilters = new JSONModel({
        MATNR: "",
        WERKS: "",
        CHARG: "",
        Status: "" // All | Green | Yellow | Red
      });
      this.getView().setModel(oFilters, "filters");

      // Avoid calling getBinding too early — update count once table finishes updating
      const oTable = this.byId("tblMaterials");
      if (oTable) {
        oTable.attachEventOnce("updateFinished", this._updateCount.bind(this));
      }
    },

    // ===== Status color mapping for table =====
    criticalityToState: function (iCriticality) {
      switch (Number(iCriticality)) {
        case 3: return "Success"; // Green
        case 2: return "Warning"; // Yellow
        default: return "Error";  // Red
      }
    },

    // ===== Search / Clear =====
    onSearch: function () {
      const oTable = this.byId("tblMaterials");
      if (!oTable) return;

      const oBinding = oTable.getBinding("items");
      if (!oBinding) return;

      const f = this.getView().getModel("filters").getData();
      const aFilters = [];

      if (f.MATNR) aFilters.push(new Filter("MATNR", FilterOperator.Contains, f.MATNR));
      if (f.WERKS) aFilters.push(new Filter("WERKS", FilterOperator.EQ, f.WERKS));
      if (f.CHARG) aFilters.push(new Filter("CHARG", FilterOperator.Contains, f.CHARG));
      if (f.Status) aFilters.push(new Filter("Status", FilterOperator.EQ, f.Status));

      oBinding.filter(aFilters);
      this._updateCount();
    },

    onClear: function () {
      const oModel = this.getView().getModel("filters");
      oModel.setData({ MATNR: "", WERKS: "", CHARG: "", Status: "" });
      this.onSearch();
    },

    // ===== Download Report =====
    onDownload: async function () {
      try {
        const oTable = this.byId("tblMaterials");
        if (!oTable) return;

        const oBinding = oTable.getBinding("items");
        if (!oBinding) return;

        const iLen = oBinding.getLength();
        const aCtx = await oBinding.requestContexts(0, iLen);
        const aData = aCtx.map(c => c.getObject());

        const aColumns = [
          { label: "Material", property: "MATNR", type: EdmType.String },
          { label: "Plant", property: "WERKS", type: EdmType.String },
          { label: "Batch", property: "CHARG", type: EdmType.String },
          { label: "Mfg Date", property: "HSDAT", type: EdmType.Date },
          { label: "Expiry Date", property: "VFDAT", type: EdmType.Date },
          { label: "Remaining (Days)", property: "RemainingDays", type: EdmType.Number },
          { label: "Status", property: "Status", type: EdmType.String }
        ];

        const oSheet = new Spreadsheet({
          workbook: { columns: aColumns },
          dataSource: aData,
          fileName: "ShelfLifeReport.xlsx"
        });

        await oSheet.build();
        oSheet.destroy();
        MessageToast.show("Report downloaded ✅");
      } catch (e) {
        MessageBox.error("Download failed: " + (e.message || e));
      }
    },

    // ========================================================================
    //  SCAN CET TAG (Camera/File Capture) -> Agent Stub -> POPUP Output
    // ========================================================================
    onScanTag: function () {
      try {
        const input = document.getElementById("tagFileInput");
        if (!input) {
          MessageBox.error(
            "Tag input not found.\n\nAdd this to your view inside <content>:\n" +
            "<core:HTML id=\"htmlTagCapture\" content=\"&lt;input id='tagFileInput' type='file' accept='image/*' capture='environment' style='display:none' /&gt;\" />"
          );
          return;
        }

        input.value = "";

        input.onchange = async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) {
            MessageToast.show("No image selected.");
            return;
          }
          if (!file.type || !file.type.startsWith("image/")) {
            MessageBox.error("Please select a valid image file.");
            return;
          }

          this.getView().setBusy(true);

          try {
            const base64 = await this._fileToBase64(file);

            // Save captured image payload for agent
            this._tagImage = {
              fileName: file.name,
              mimeType: file.type,
              base64: base64
            };

            // Call agent (stub for now)
            const result = await this._callTagAgentStub(this._tagImage);

            // Show output popup (your requested “card” style)
            this._openResultDialog(result);

            // Map JSON -> filters + status, then run search
            this._applyAgentResultToFilters(result);

            MessageToast.show("Tag processed ✅");
          } catch (err) {
            console.error(err);
            MessageBox.error("Failed to process tag: " + (err.message || err));
          } finally {
            this.getView().setBusy(false);
          }
        };

        input.click();

      } catch (err) {
        console.error(err);
        MessageBox.error("Scan failed: " + (err.message || err));
      }
    },

    _fileToBase64: function (file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result || "";
          const base64 = result.split(",")[1];
          if (!base64) reject(new Error("Unable to read file as base64."));
          else resolve(base64);
        };
        reader.onerror = () => reject(reader.error || new Error("File read error."));
        reader.readAsDataURL(file);
      });
    },

    // ===== Agent stub (Offline demo) =====
    _callTagAgentStub: async function (tagImage) {
      // You can ignore tagImage for now; it's here to match the real call signature.

      return {
        materialId: "7000001003", 
        batch: "5011",
        storageClass: "Cold (≤ -18°C)",

        remainingUsableLifePct: 72,
        risk: "GREEN",
        exposureClock: "ACTIVE",
        totalExposureHrs: 128,
        maxAllowedHrs: 480,

        lastEvaluated: "2026-02-19 14:32",
        qaHoldRequired: "NO",

        confidence: 0.93
      };

      /*
      // =============================
      // REAL AGENT CALL (UNCOMMENT LATER)
      // =============================
      const url = "/agent/parseTag"; // destination/proxy path
      const payload = {
        imageBase64: tagImage.base64,
        mimeType: tagImage.mimeType,
        fileName: tagImage.fileName
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Agent API error: ${res.status} ${res.statusText}`);
      return await res.json();
      */
    },

    // ===== Map agent JSON -> UI filters & status =====
    _applyAgentResultToFilters: function (r) {
      const oFiltersModel = this.getView().getModel("filters");
      if (!oFiltersModel) return;

      if (r.materialId) oFiltersModel.setProperty("/MATNR", r.materialId);
      if (r.batch)      oFiltersModel.setProperty("/CHARG", r.batch);

      // Map risk -> your filter Status (Green/Yellow/Red)
      if (r.risk) {
        const status = (r.risk === "GREEN") ? "Green" : (r.risk === "YELLOW") ? "Yellow" : "Red";
        oFiltersModel.setProperty("/Status", status);
      }

      this.onSearch();
    },

    // ===== Popup dialog output card =====
    _openResultDialog: function (r) {
      if (!this._oResultDialog) {
        this._oResultDialog = new Dialog(this.createId("dlgTagResult"), {
          title: "Aerospace Material – Exposure Tracking",
          contentWidth: "44rem",
          horizontalScrolling: false,
          verticalScrolling: true,
          stretch: Device.system.phone,
          endButton: new Button({
            text: "Close",
            press: () => this._oResultDialog.close()
          })
        });

        this.getView().addDependent(this._oResultDialog);
      }

      this._oResultDialog.removeAllContent();

      const riskState =
        (r.risk === "GREEN") ? "Success" :
        (r.risk === "YELLOW") ? "Warning" : "Error";

      const pct = (r.remainingUsableLifePct != null) ? Number(r.remainingUsableLifePct) : 0;

      // Header: Material + Batch + Storage Class
      const header = new VBox({
        items: [
          new HBox({
            justifyContent: "SpaceBetween",
            items: [
              new Text({ text: "Material ID: " + (r.materialId || "-") }),
              new Text({ text: "Batch: " + (r.batch || "-") }),
              new Text({ text: "Storage Class: " + (r.storageClass || "-") })
            ]
          })
        ]
      }).addStyleClass("sapUiSmallMarginBottom");

      // Middle: Remaining usable life + risk + progress + exposure box
      const middle = new HBox({
        justifyContent: "SpaceBetween",
        alignItems: "Center",
        items: [
          new VBox({
            items: [
              new Title({ text: "REMAINING USABLE LIFE", level: "H4" }),
              new HBox({
                alignItems: "Center",
                items: [
                  new Title({ text: pct + "%", level: "H1" }).addStyleClass("sapUiTinyMarginEnd"),
                  new ObjectStatus({ text: "RISK: " + (r.risk || "-"), state: riskState })
                ]
              }),
              new ProgressIndicator({
                percentValue: pct,
                displayValue: pct + "%",
                state: riskState,
                width: "22rem"
              })
            ]
          }),

          new VBox({
            width: "18rem",
            items: [
              new Text({ text: "Exposure Clock: " + (r.exposureClock || "-") }),
              new Text({ text: "Total Exposure: " + (r.totalExposureHrs ?? "-") + " hrs" }),
              new Text({ text: "Max Allowed: " + (r.maxAllowedHrs ?? "-") + " hrs" })
            ]
          }).addStyleClass("sapUiSmallMarginBegin")
        ]
      }).addStyleClass("sapUiSmallMarginBottom");

      // Footer: Last evaluated + QA hold
      const footer = new VBox({
        items: [
          new Text({ text: "Last Evaluated: " + (r.lastEvaluated || "-") }),
          new Text({ text: "QA Hold Required: " + (r.qaHoldRequired || "-") })
        ]
      });

      const contentBox = new VBox({
        width: "100%",
        items: [header, middle, footer]
      })
      .addStyleClass("sapUiResponsiveContentPadding");
      
      this._oResultDialog.addContent(contentBox);

      /* this._oResultDialog.addContent(header);
      this._oResultDialog.addContent(middle);
      this._oResultDialog.addContent(footer); */

      this._oResultDialog.open();
    },

    // ===== Table count =====
    _updateCount: function () {
      const oTable = this.byId("tblMaterials");
      const oTxt = this.byId("txtCount");
      if (!oTable || !oTxt) return;

      const oBinding = oTable.getBinding("items");
      if (!oBinding) return;

      const iLen = oBinding.getLength();
      oTxt.setText(iLen > 0 ? `${iLen} items` : "");
    }

  });
});