window.onload = function () {

  var c = document.getElementById('canvas');

  c.width = 300;
  c.height = 300;

  var gl = c.getContext('webgl') || c.getContext('experimental-webgl');

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var v_shader = create_shader('vs');
  var f_shader = create_shader('fs');

  var prg = create_program(v_shader, f_shader);

  // attributeLocationを配列に登録
  var attLocation = new Array();
  attLocation[0] = gl.getAttribLocation(prg, 'position');
  attLocation[1] = gl.getAttribLocation(prg, 'normal');
  attLocation[2] = gl.getAttribLocation(prg, 'color');

  // attributeの要素数を配列に格納
  var attStride = new Array();
  attStride[0] = 3;
  attStride[1] = 3;
  attStride[2] = 4;

  // 頂点の位置情報を格納する配列
  var vertex_position = [
    0.0, 1.0, 0.0,
    1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0,
    0.0, -1.0, 0.0
  ];

  // 頂点の色情報を格納する配列
  var vertex_color = [
    1.0, 0.0, 0.0, 1.0,
    0.0, 1.0, 0.0, 1.0,
    0.0, 0.0, 1.0, 1.0,
    1.0, 1.0, 1.0, 1.0
  ];

  // 頂点のインデックスを格納する配列
  var ibo_index = [
    0, 1, 2,
    1, 2, 3
  ];

  // 環境光の色
  var ambientColor = [0.1, 0.1, 0.1, 0.1];

  var torusData = torus(32, 32, 0.5, 1.0);
  vertex_position = torusData[0];
  vertex_normal = torusData[1]
  vertex_color = torusData[2];
  ibo_index = torusData[3];

  // 球体の頂点データからVBOを生成し配列に格納
  var sphereData = sphere(64, 64, 2.0, [0.25, 0.25, 0.75, 1.0]);
  var sPositon = create_vbo(sphereData.p);
  var sNormal = create_vbo(sphereData.n);
  var sColor = create_vbo(sphereData.c);
  var sVBOList = [sPositon, sNormal, sColor];

  // 球体用IBO作成
  var sIndex = create_ibo(sphereData.i);

  // VBOを生成
  var vbo = new Array(3);
  vbo[0] = create_vbo(vertex_position);
  vbo[1] = create_vbo(vertex_normal);
  vbo[2] = create_vbo(vertex_color);

  // VBOをバインドし、登録する
  set_attribute(vbo, attLocation, attStride);

  // IBOを生成
  var ibo = create_ibo(ibo_index);
  
  // IBOをバインドし、登録する
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);

  var m = new matIV();

  var mMatrix = m.identity(m.create());
  var vMatrix = m.identity(m.create());
  var pMatrix = m.identity(m.create());
  var tmpMatrix = m.identity(m.create());
  var mvpMatrix = m.identity(m.create());
  var invMatrix = m.identity(m.create());

  var uniLocation = new Array();
  uniLocation[0] = gl.getUniformLocation(prg, 'mvpMatrix');
  uniLocation[1] = gl.getUniformLocation(prg, 'mMatrix');
  uniLocation[2] = gl.getUniformLocation(prg, 'invMatrix');
  uniLocation[3] = gl.getUniformLocation(prg, 'lightPosition');
  uniLocation[4] = gl.getUniformLocation(prg, 'eyeDirection');
  uniLocation[5] = gl.getUniformLocation(prg, 'ambientColor');

  // 視点の向き
  var eyeDirection = [0.0, 0.0, 10.0];

  // ビュー座標変換行列
  m.lookAt(eyeDirection, [0, 0, 0], [0, 1, 0], vMatrix);
  m.perspective(60, c.width / c.height, 0.1, 100, pMatrix);
  m.multiply(pMatrix, vMatrix, tmpMatrix);

  // 平行光源の向き
  var lightPosition = [0.0, 0.0, 0.0];

  // カウンタ
  var count = 0;

  // HSV to RGB
  function hsva(h, s, v, a){
    if(s > 1 || v > 1 || a > 1){return;}
    var th = h % 360;
    var i = Math.floor(th / 60);
    var f = th / 60 - i;
    var m = v * (1 - s);
    var n = v * (1 - s * f);
    var k = v * (1 - s * (1 - f));
    var color = new Array();
    if(!s > 0 && !s < 0){
        color.push(v, v, v, a); 
    } else {
        var r = new Array(v, n, m, m, k, v);
        var g = new Array(k, v, v, n, m, m);
        var b = new Array(m, m, k, v, v, n);
        color.push(r[i], g[i], b[i], a);
    }
    return color;
  } 

  // トーラスの描画
  // row: 円の数
  // column: 円一つあたりの頂点数
  // irad: 円の半径
  // orad: トーラス全体の半径
  function torus(row, column, irad, orad){
    var pos = new Array(), nor = new Array(),
        col = new Array(), idx = new Array();
    for(var i = 0; i <= row; i++){
        var r = Math.PI * 2 / row * i;
        var rr = Math.cos(r);
        var ry = Math.sin(r);
        for(var ii = 0; ii <= column; ii++){
            var tr = Math.PI * 2 / column * ii;
            var tx = (rr * irad + orad) * Math.cos(tr);
            var ty = ry * irad;
            var tz = (rr * irad + orad) * Math.sin(tr);
            var rx = rr * Math.cos(tr);
            var rz = rr * Math.sin(tr);
            pos.push(tx, ty, tz);
            nor.push(rx, ry, rz);
            var tc = hsva(360 / column * ii, 1, 1, 1);
            col.push(tc[0], tc[1], tc[2], tc[3]);
        }
    }
    for(i = 0; i < row; i++){
        for(ii = 0; ii < column; ii++){
            r = (column + 1) * i + ii;
            idx.push(r, r + column + 1, r + 1);
            idx.push(r + column + 1, r + column + 2, r + 1);
        }
    }
    return [pos, nor, col, idx];
  }

	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL);
	gl.enable(gl.CULL_FACE);

  // 回常ループ
  (function () {

    // canvasを初期化
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // カウンタをインクリメント
    count++;

    // カウンタを元にラジアン(0~359)と各種座標を取得
    var rad = (count % 360) * Math.PI / 180;
    var tx = Math.cos(rad) * 3.5;
    var ty = Math.sin(rad) * 3.5;
    var tz = Math.sin(rad) * 3.5;

    // トーラスのIBOとVBOを設定
    set_attribute(vbo, attLocation, attStride);

    // IBOをバインドし、登録する
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);

    m.identity(mMatrix);
    m.translate(mMatrix, [tx, -ty, -tz], mMatrix);
    m.rotate(mMatrix, -rad, [0, 1, 1], mMatrix);
    m.multiply(tmpMatrix, mMatrix, mvpMatrix);
    m.inverse(mMatrix, invMatrix);

    // uniform変数の登録と描画
    gl.uniformMatrix4fv(uniLocation[0], false, mvpMatrix);
    gl.uniformMatrix4fv(uniLocation[1], false, mMatrix);
    gl.uniformMatrix4fv(uniLocation[2], false, invMatrix);
    gl.uniform3fv(uniLocation[3], lightPosition);
    gl.uniform3fv(uniLocation[4], eyeDirection);
    gl.uniform4fv(uniLocation[5], ambientColor);
    gl.drawElements(gl.TRIANGLES, ibo_index.length, gl.UNSIGNED_SHORT, 0);

    // 球体のVBO,IBOをセット
    set_attribute(sVBOList, attLocation, attStride);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sIndex);

    // モデル座標変換行列の生成
    m.identity(mMatrix);
    m.translate(mMatrix, [-tx, ty, tz], mMatrix);
    m.multiply(tmpMatrix, mMatrix, mvpMatrix);
    m.inverse(mMatrix, invMatrix);

    // uniform変数の登録と描画
    gl.uniformMatrix4fv(uniLocation[0], false, mvpMatrix);
    gl.uniformMatrix4fv(uniLocation[1], false, mMatrix);
    gl.uniformMatrix4fv(uniLocation[2], false, invMatrix);
    gl.drawElements(gl.TRIANGLES, sphereData.i.length, gl.UNSIGNED_SHORT, 0);

    // コンテキストの再描画
    gl.flush();

    // ループのための再帰呼び出し
    setTimeout(arguments.callee, 1000 / 60);

  })();

  // IBOを生成する関数
  function create_ibo(data) {
    // バッファオブジェクトの生成
    var ibo = gl.createBuffer();

    // バッファをバインドする
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);

    // バッファにデータをセット
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(data), gl.STATIC_DRAW);

    // バッファのバインドを無効化
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return ibo;

  }

  // モデル行列から変換行列を完成させレンダリングする
  function render_model(mMatrix) {
    m.multiply(tmpMatrix, mMatrix, mvpMatrix);
    gl.uniformMatrix4fv(uniLocation[0], false, mvpMatrix);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  function set_attribute(vbo, attL, attS) {
    // 引数として受け取った配列を処理する
    for (var i in vbo) {
      // バッファをバインド
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo[i]);

      // attributeLocationを有効にする
      gl.enableVertexAttribArray(attL[i]);

      // attributeLocationを通知し登録する
      gl.vertexAttribPointer(attL[i], attS[i], gl.FLOAT, false, 0, 0);

    }
  }

  function create_shader(id) {
    var shader;

    var scriptElement = document.getElementById(id);

    if(!scriptElement){return;};

    switch(scriptElement.type) {
      case "x-shader/x-vertex":
        shader = gl.createShader(gl.VERTEX_SHADER);
        break;

      case "x-shader/x-fragment":
        shader = gl.createShader(gl.FRAGMENT_SHADER);
        break;

      default:
        return;
    }

    // 生成されたシェーダーにソースを割り当てる
    gl.shaderSource(shader, scriptElement.text);

    gl.compileShader(shader);

    if(gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      return shader;
    } else {
      alert(gl.getShaderInfoLog(shader));
    }
  }

  function create_program(vs, fs) {
    var program = gl.createProgram();

    // プログラムオブジェクトにシェーダーを割り当てる
    gl.attachShader(program,vs);
    gl.attachShader(program,fs);

    gl.linkProgram(program);

    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.useProgram(program);
      return program;
    } else {
      alert(gl.getProgramInfoLog(program));
    }
  }

  function create_vbo(data) {
    var vbo = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return vbo;
  }

}

// 球体を生成する関数
function sphere(row, column, rad, color){
    var pos = new Array(), nor = new Array(),
        col = new Array(), idx = new Array();
    for(var i = 0; i <= row; i++){
        var r = Math.PI / row * i;
        var ry = Math.cos(r);
        var rr = Math.sin(r);
        for(var ii = 0; ii <= column; ii++){
            var tr = Math.PI * 2 / column * ii;
            var tx = rr * rad * Math.cos(tr);
            var ty = ry * rad;
            var tz = rr * rad * Math.sin(tr);
            var rx = rr * Math.cos(tr);
            var rz = rr * Math.sin(tr);
            if(color){
                var tc = color;
            }else{
                tc = hsva(360 / row * i, 1, 1, 1);
            }
            pos.push(tx, ty, tz);
            nor.push(rx, ry, rz);
            col.push(tc[0], tc[1], tc[2], tc[3]);
        }
    }
    r = 0;
    for(i = 0; i < row; i++){
        for(ii = 0; ii < column; ii++){
            r = (column + 1) * i + ii;
            idx.push(r, r + 1, r + column + 2);
            idx.push(r, r + column + 2, r + column + 1);
        }
    }
    return {p : pos, n : nor, c : col, i : idx};
}
