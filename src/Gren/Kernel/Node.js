/*

import Gren.Kernel.Platform exposing (export)

*/

var _Node_log = F2(function (text, args) {
  // This function is used for simple applications where the main function returns String
  // NOTE: this function needs __Platform_export available to work
  console.log(text);
  return {};
});
