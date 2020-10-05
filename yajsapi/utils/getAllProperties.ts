export default function getAllProperties(obj: any) {
  var allProps: any = [],
    curr = obj;
  do {
    var props = Object.getOwnPropertyNames(curr);
    props.forEach(function (prop) {
      if (allProps.indexOf(prop) === -1) allProps.push(prop);
    });
  } while ((curr = Object.getPrototypeOf(curr)));
  return allProps;
}
