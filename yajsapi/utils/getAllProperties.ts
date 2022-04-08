export default function getAllProperties(obj: any) {
  const allProps: any = [];
  let curr = obj;
  do {
    const props = Object.getOwnPropertyNames(curr);
    props.forEach(function (prop) {
      if (allProps.indexOf(prop) === -1) allProps.push(prop);
    });
  } while ((curr = Object.getPrototypeOf(curr)));
  return allProps;
}
