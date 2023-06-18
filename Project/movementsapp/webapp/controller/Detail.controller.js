sap.ui.define(
  [
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../model/formatter",
    "sap/m/library",
  ],
  function (BaseController, JSONModel, formatter, mobileLibrary) {
    "use strict";

    // shortcut for sap.m.URLHelper
    var URLHelper = mobileLibrary.URLHelper;

    return BaseController.extend("movementsapp.controller.Detail", {
      formatter: formatter,

      /* =========================================================== */
      /* lifecycle methods                                           */
      /* =========================================================== */

      onInit: function () {
        // Model used to manipulate control states. The chosen values make sure,
        // detail page is busy indication immediately so there is no break in
        // between the busy indication for loading the view's meta data
        var oViewModel = new JSONModel({
          busy: false,
          delay: 0,
          new: false,
        });

        this.getRouter()
          .getRoute("object")
          .attachPatternMatched(this._onObjectMatched, this);

        this.setModel(oViewModel, "detailView");

        this.getOwnerComponent()
          .getModel()
          .metadataLoaded()
          .then(this._onMetadataLoaded.bind(this));
      },

      /* =========================================================== */
      /* event handlers                                              */
      /* =========================================================== */

      /**
       * Event handler when the share by E-Mail button has been clicked
       * @public
       */
      onSendEmailPress: function () {
        var oViewModel = this.getModel("detailView");

        URLHelper.triggerEmail(
          null,
          oViewModel.getProperty("/shareSendEmailSubject"),
          oViewModel.getProperty("/shareSendEmailMessage")
        );
      },
      onSave: function () {
        this.getModel("detailView").setProperty("/busy", true);
        this.getModel().submitChanges({
          success: (result) => {
            this.getModel("detailView").setProperty("/busy", false);
            sap.m.MessageToast.show(this.getResourceBundle().getText("saved"));
            if (this.getModel("detailView").getProperty("/new"))
              this.getRouter().navTo("list");
          },
          error: (error) => {
            this.getModel("detailView").setProperty("/busy", false);
            console.error(error);
            sap.m.MessageBox.error(error.responseText);
          },
        });
      },

      onDelete: function () {
        this.getModel("detailView").setProperty("/busy", true);
        this.getModel().remove(this.getView().getBindingContext().getPath(), {
          success: (result) => {
            this.getModel("detailView").setProperty("/busy", false);
            sap.m.MessageToast.show(
              this.getResourceBundle().getText("deleted")
            );
            this.getRouter().navTo("list");
          },
          error: (error) => {
            this.getModel("detailView").setProperty("/busy", false);
            console.error(error);
            sap.m.MessageBox.error(error.responseText);
          },
        });
      },

      onCancel: function () {
        this.getModel().resetChanges();
        this.getRouter().navTo("list");
      },

      /* =========================================================== */
      /* begin: internal methods                                     */
      /* =========================================================== */

      /**
       * Binds the view to the object path and expands the aggregated line items.
       * @function
       * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
       * @private
       */
      _onObjectMatched: function (oEvent) {
        this.getModel("detailView").setProperty("/new", false);

        const sObjectId = oEvent.getParameter("arguments").objectId,
          model = this.getModel();
        this.getModel("appView").setProperty(
          "/layout",
          "TwoColumnsMidExpanded"
        );
        model.resetChanges();
        if (sObjectId === "new") {
          // this.getView().setModel(model);
          const bindingContext = model.createEntry("/MOVEMENTSet", {
            properties: {
              Id: "",
              Type: "IN",
              MovDate: "",
              Partner: "",
              Location: "NOORD",
              Finished: false,
            },
          });
          this.getView().bindElement(bindingContext.getPath());
          this.getModel("detailView").setProperty("/new", true);
          this.getModel("detailView").setProperty("/busy", false);
        } else {
          this.getModel()
            .metadataLoaded()
            .then(
              function () {
                var sObjectPath = model.createKey("MOVEMENTSet", {
                  Id: sObjectId,
                });
                this._bindView("/" + sObjectPath);
              }.bind(this)
            );
        }
      },

      /**
       * Binds the view to the object path. Makes sure that detail view displays
       * a busy indicator while data for the corresponding element binding is loaded.
       * @function
       * @param {string} sObjectPath path to the object to be bound to the view.
       * @private
       */
      _bindView: function (sObjectPath) {
        // Set busy indicator during view binding
        var oViewModel = this.getModel("detailView");

        // If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
        oViewModel.setProperty("/busy", false);

        this.getView().bindElement({
          path: sObjectPath,
          parameters: { expand: "MovementItemSet" },
          events: {
            change: this._onBindingChange.bind(this),
            dataRequested: function () {
              oViewModel.setProperty("/busy", true);
            },
            dataReceived: function () {
              oViewModel.setProperty("/busy", false);
            },
          },
        });
      },

      _onBindingChange: function () {
        var oView = this.getView(),
          oElementBinding = oView.getElementBinding();

        // No data for the binding
        if (!oElementBinding.getBoundContext()) {
          this.getRouter().getTargets().display("detailObjectNotFound");
          // if object could not be found, the selection in the list
          // does not make sense anymore.
          // this.getOwnerComponent().oListSelector.clearListListSelection();
          return;
        }

        var sPath = oElementBinding.getPath(),
          oResourceBundle = this.getResourceBundle(),
          oObject = oView.getModel().getObject(sPath),
          sObjectId = oObject.Id,
          sObjectName = oObject.Id,
          oViewModel = this.getModel("detailView");

        this.getOwnerComponent().oListSelector.selectAListItem(sPath);

        oViewModel.setProperty(
          "/shareSendEmailSubject",
          oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId])
        );
        oViewModel.setProperty(
          "/shareSendEmailMessage",
          oResourceBundle.getText("shareSendEmailObjectMessage", [
            sObjectName,
            sObjectId,
            location.href,
          ])
        );
      },

      _onMetadataLoaded: function () {
        // Store original busy indicator delay for the detail view
        var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
          oViewModel = this.getModel("detailView");

        // Make sure busy indicator is displayed immediately when
        // detail view is displayed for the first time
        oViewModel.setProperty("/delay", 0);

        // Binding the view will set it to not busy - so the view is always busy if it is not bound
        oViewModel.setProperty("/busy", true);
        // Restore original busy indicator delay for the detail view
        oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
      },

      /**
       * Set the full screen mode to false and navigate to list page
       */
      onCloseDetailPress: function () {
        this.getModel("appView").setProperty(
          "/actionButtonsInfo/midColumn/fullScreen",
          false
        );
        // No item should be selected on list after detail page is closed
        this.getOwnerComponent().oListSelector.clearListListSelection();
        this.getRouter().navTo("list");
      },

      /**
       * Toggle between full and non full screen mode.
       */
      toggleFullScreen: function () {
        var bFullScreen = this.getModel("appView").getProperty(
          "/actionButtonsInfo/midColumn/fullScreen"
        );
        this.getModel("appView").setProperty(
          "/actionButtonsInfo/midColumn/fullScreen",
          !bFullScreen
        );
        if (!bFullScreen) {
          // store current layout and go full screen
          this.getModel("appView").setProperty(
            "/previousLayout",
            this.getModel("appView").getProperty("/layout")
          );
          this.getModel("appView").setProperty(
            "/layout",
            "MidColumnFullScreen"
          );
        } else {
          // reset to previous layout
          this.getModel("appView").setProperty(
            "/layout",
            this.getModel("appView").getProperty("/previousLayout")
          );
        }
      },
    });
  }
);
