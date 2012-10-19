YUI.add("todo", function(Y){
	

	/**
	In some cases, we don't actually have to extend the Model object.  However, when we want a custom synchronization layer
	like the one below, its simpler to extend it. 
	The logic is that when a .save is called, if the "id" attribute is null, its considered "new", and a "create" action is passed, otherwise
	an "update" action is passed.  
	*/
	var TodoModel = Y.Base.create("todo-model", Y.Model, [],{
		toggleCompleted: function() {
			this.set("completed", !this.get("completed"));
			this.save();
		},
		sync: function(action, options, callback) {
			switch (action) {
				case 'update':
					callback(null, this._update());
					break;
				case 'create':
					callback(null, this._persist());
					break;
				case 'delete':
					callback(null, this._remove());
					break;
			}
		},
		_update: function() {
			var list = Y.StorageLite.getItem("todo-list", true);
			Y.Array.some(list, function(o, idx, arr) {
				if (o.id === this.get("id")) {
					o.completed = this.get("completed");
					o.label = this.get("label");
					return true;
				}
			}, this);
			Y.StorageLite.setItem("todo-list", list, true);
		},
		_persist: function() {
			var arr = Y.StorageLite.getItem("todo-list", true);
			this.set("id", new Date().getTime());

			var obj = this.toJSON()
			obj["id"] = this.get("id");
			arr.push(obj);
			Y.StorageLite.setItem("todo-list", arr, true);
		},
		_remove: function() {
			var list = Y.StorageLite.getItem("todo-list", true);
			Y.Array.some(list, function(o, idx, arr) {
				if (o.id === this.get("id")) {
					arr.splice(idx,1);
					return true;
				}
			}, this);
			Y.StorageLite.setItem("todo-list", list, true);
		}
	}, {
		ATTRS: {
			label: {
				value: "",
				validator: Y.Lang.isString
			},
			completed: {
				value: false,
				validator: Y.Lang.isBoolean
			}
		}
	});
	
	/**
	The logic for extending is the same as for the Model above.  In this case, the only real synchronization for the List is a "load", which executes the action of "read"
	*/
	var TodoModelList = Y.Base.create("todo-model-list", Y.ModelList, [],{
		model: TodoModel,
		sync: function(action, options, callback) {
			switch (action) {
				case 'read':
					this._loadModels(callback);
					break;
			}
		},
		_loadModels: function(callback) {
			//lets use the Storage Utility from the gallery
			var models = Y.StorageLite.getItem("todo-list", true);
			if (models) {
				callback(null, models);
			} else {
				Y.StorageLite.setItem("todo-list", [],true);
			}
		}
	});

	/**
	We are using a single View object to handle the entire lifecycle of the Todo application.  An alternative approach is provided at http://yuilibrary.com/yui/docs/app/app-todo.html.
	*/
	Y.TodoView = new Y.Base.create("todo-view", Y.View, [], {
		events: {
			"#todo" : {keypress: "addTodo"},
			"em.delete" : {click: "removeTodo"},
			"em.checkbox" : {click: "toggleCompleteTodo"},
			"label": {click:"toggleCompleteTodo"}
		},
		initializer: function() {
			var container = this.get("container");

			var list = this.list = new TodoModelList();
			

			this.set("todoInput", container.one("#todo"));
			this.set("todoList", container.one("#todoList"));

			list.load();
		},
		render: function() {
			var list = this.list;
			if (list.isEmpty()) {
				//for chaining
				return this;
			}
			//create document fragment so that we don't repaint constantly
			var fragment = Y.one(Y.config.doc.createDocumentFragment());
			list.each(function(o) {
				fragment.append(this._createTodo(o.get("label"), o.get("completed"), o.get("completed"), o.get("id")));
			},this);
			this.get("todoList").setHTML(fragment);
		},
		addTodo: function(e) {
			if (e.keyCode === 13) {
				var label = this.get("todoInput").get("value");
				var model = this.list.add({label: label});
				model.save();
				var li = this._createTodo(label, null, null, model.get("id"));
				this.get("todoList").append(li);
				this.get("todoInput").set("value", "");
			}
		},
		_createTodo: function(label, checked, completed, id) {
			var cfg = {
				item: label,
				checked: (checked ? "checked" : null),
				completed: (completed ? "completed" : null),
				id: (id ? id : null)
			};
			var li = Y.Node.create(Y.Lang.sub(Y.TodoView.TODO_HTML,cfg));
			li.setData("id", id);
			return li;
		},
		removeTodo: function(e) {
			var el = e.currentTarget;
			this.list.getById(el.getAttribute("data-id")).destroy({remove:true});
			el.ancestor("li").remove();
		},
		toggleCompleteTodo: function(e) {
			var el = e.currentTarget;
			var parent = el.ancestor("li")
			var label = parent.one("label");
			var checkbox = parent.one("em.checkbox");
			label.toggleClass("completed");
			checkbox.toggleClass("checked");
			//update model, and localstorage
			this.list.getById(parent.getData("id")).toggleCompleted();
		}

	}, {
		TODO_HTML : "<li><div><em class='checkbox {checked}'></em> <label class='{completed}'>{item}</label> <em class='delete' data-id='{id}'></em></div></li>"
	});

}, "0.1", {requires: ["base", "model-list", "view", "gallery-storage-lite"]});