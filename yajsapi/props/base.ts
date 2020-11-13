import dayjs from "dayjs";
import { getAllProperties } from "../utils";
export function as_list(data: string | string[]): string[] {
  if (!(typeof data == "string")) return data;
  let item = JSON.parse(data);
  if (typeof item == "object")
    // is array?
    return item;
  return [JSON.stringify(item)];
}

function _find_enum(enum_type: object, val: string): any {
  for (let member of Object.entries(enum_type)) {
    if (member[1] == val) return member;
  }
  return null;
}

export class Field {
  private _value;
  private _metadata;
  private _name;
  private _type;
  constructor({
    value,
    metadata,
    name,
  }: { value?: any; metadata?: object; name?: string; type?: object } = {}) {
    this._value = value || null;
    this._metadata = metadata || {};
    this._name = name || null;
    this._type = typeof value;
  }

  set value(x) {
    if (this._type === "undefined" || this._type === "null") {
      this._type = typeof x;
    } else if (this._type !== typeof this._value) {
      throw Error("wrong type");
    }
    this._value = x;
  }

  get value() {
    return this._value;
  }

  get metadata() {
    return this._metadata;
  }

  set name(x) {
    this._name = x;
  }

  get name() {
    return this._name;
  }

  get type() {
    return this._type;
  }

  valueOf() {
    return this._value;
  }
}

class _PyField {
  name: string;
  type: object;
  required!: boolean;

  constructor(name, type, required) {
    this.name = name;
    this.type = type;
    this.required = required;
  }

  encode(value: string) {
    if (this.type === Date)
      return [
        this.name,
        dayjs.unix(parseInt((parseFloat(value) * 0.001).toString())).toDate(),
      ];
    return [this.name, value];
  }
}

class InvalidPropertiesError extends Error {
    // Raised by `Model.from_props(cls, props)` when given invalid `props`.
    constructor(key: string, description: string) {
      super(description);
      this.name = key;
    }
}
export class Model {
  constructor() {}

  _custom_mapping(props: object, data: object) {}

  fields(cls): Field[] {
    let fields: Field[] = [];
    let props = getAllProperties(cls);
    for (let prop of props) {
      if (cls[prop] instanceof Field) {
        cls[prop].name = prop;
        fields.push(cls[prop]);
      }
    }
    return fields;
  }

  from_props(props: object): any {
    let field_map = {};
    let data = {};
    for (let f of this.fields(this)) {
      if ("key" in f.metadata) {
        field_map[f.metadata["key"]] = new _PyField(f.name, f.type, !!f.value);
      }
    }

    for (const [key, val] of Object.entries(props)) {
      if (key in field_map) {
        let [_key, _val] = field_map[key].encode(val);
        data[_key] = _val;
      }
    }

    this._custom_mapping(props, data);
    let self = new (Object.getPrototypeOf(this).constructor)();
    for (let [key, value] of Object.entries(data)) {
      if(self[key] instanceof Field) {
        self[key].value = value;
      } else  {
        self[key] = value;
      }
    }
    return self;
  }

  keys(): any {
    class _Keys {
      constructor(iter) {
        for (let [key, value] of Object.entries(iter)) {
          this[key] = value;
        }
      }

      names() {
        return Object.keys(this);
      }

      get() {
        return this;
      }
    }

    let keyList = {};
    for (let [key, value] of Object.entries(this)) {
      keyList[key] = (value as any).metadata["key"];
    }
    return new _Keys(keyList);
  }
}
