var c;
var q = new qtnIV();
var qt = q.identity(q.create());


window.onload = function () {

  // canvasとクォータニオンをグローバル変数とする
  c = document.getElementById('canvas');

  // input rangeエレメント
  var eLines     = document.getElementById('lines');
	var eLineStrip = document.getElementById('line_strip');
	var eLineLoop  = document.getElementById('line_loop');
	var ePointSize = document.getElementById('point_size');

  // マウスムーブイベントリスナ
  function mouseMove(e) {
    var cw = c.width;
    var ch = c.height;
    var wh = 1 / Math.sqrt(cw * cw + ch * ch);
    var x = e.clientX - c.offsetLeft - cw * 0.5;
    var y = e.clientY - c.offsetTop - ch * 0.5;
    var sq = Math.sqrt(x * x + y * y);
    var r = sq * 2.0 * Math.PI * wh;
    if (sq != 1) {
      sq = 1 / sq;
      x *= sq;
      y *= sq;
    }
    q.rotate(r, [y, x, 0.0], qt);
  }

  c.width = 500;
  c.height = 300;

  c.addEventListener('mousemove', mouseMove, true);

  var gl = c.getContext('webgl', {stencil: true}) || c.getContext('experimental-webgl', {stencil: true});

  var v_shader = create_shader('vs');
  var f_shader = create_shader('fs');

  var prg = create_program(v_shader, f_shader);

  // attributeLocationを配列に登録
  var attLocation = new Array();
  attLocation[0] = gl.getAttribLocation(prg, 'position');
  attLocation[1] = gl.getAttribLocation(prg, 'normal');
  attLocation[2] = gl.getAttribLocation(prg, 'color');
  attLocation[3] = gl.getAttribLocation(prg, 'textureCoord');

  // attributeの要素数を配列に格納
  var attStride = new Array();
  attStride[0] = 3;
  attStride[1] = 3;
  attStride[2] = 4;
  attStride[3] = 2;


  // トーラスデータ
  var torusData     = torus(64, 64, 0.25, 1.0)
	var tPosition     = create_vbo(torusData.p);
	var tNormal       = create_vbo(torusData.n);
	var tColor        = create_vbo(torusData.c);
	var tTextureCoord = create_vbo(torusData.t);
	var tVBOList      = [tPosition, tNormal, tColor, tTextureCoord];
	var tIndex        = create_ibo(torusData.i);

  // sphere
  var sphereData    = sphere(64, 64, 1.0, [1.0, 1.0, 1.0, 1.0])
	var sPosition     = create_vbo(sphereData.p);
	var sNormal       = create_vbo(sphereData.n);
	var sColor        = create_vbo(sphereData.c);
	var sTextureCoord = create_vbo(sphereData.t);
	var sVBOList      = [sPosition, sNormal, sColor, sTextureCoord];
	var sIndex        = create_ibo(sphereData.i);

  var m = new matIV();
  
  // 四元数の宣言と初期化
  var aQuaternion = q.identity(q.create());
  var bQuaternion = q.identity(q.create());
  var sQuaternion = q.identity(q.create());

  var mMatrix = m.identity(m.create());
  var vMatrix = m.identity(m.create());
  var pMatrix = m.identity(m.create());
  var tmpMatrix = m.identity(m.create());
  var mvpMatrix = m.identity(m.create());
  var invMatrix = m.identity(m.create());
  var qMatrix = m.identity(m.create());

  var uniLocation = new Array();
  uniLocation[0] = gl.getUniformLocation(prg, 'mvpMatrix');
  uniLocation[1] = gl.getUniformLocation(prg, 'invMatrix');
  uniLocation[2] = gl.getUniformLocation(prg, 'lightDirection');
  uniLocation[3] = gl.getUniformLocation(prg, 'useLight');
  uniLocation[4] = gl.getUniformLocation(prg, 'texture');
  uniLocation[5] = gl.getUniformLocation(prg, 'useTexture');
  uniLocation[6] = gl.getUniformLocation(prg, 'outline');

  // 視点の向き
  var eyeDirection = [0.0, 0.0, 5.0];

  // カメラの座標
  var camPosition = [0.0, 0.0, 10.0];

  // カメラの上方向を表すベクトル
  var camUpDirection = [0.0, 1.0, 0.0];

  // 環境光
  var ambientColor = [0.1, 0.1, 0.1, 1.0];

  // 平行光源の向き
  var lightDirection = [1.0, 1.0, 1.0];

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

  // パラメーターの設定
  gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL);
  
  var texture = null;

  // テクスチャの読み込み
  create_texture('texture.png');

  // 回常ループ
  (function () {

    // canvasの初期化
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clearDepth(1.0);
		gl.clearStencil(0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

    count++;
		var rad = (count % 360) * Math.PI / 180;
		
		// ビュー行列の生成
		m.lookAt([0.0, 0.0, 10.0], [0, 0, 0], [0, 1, 0], vMatrix);
		m.perspective(45, c.width / c.height, 0.1, 100, pMatrix);
		var qMatrix = m.identity(m.create());
		q.toMatIV(qt, qMatrix);
		m.multiply(vMatrix, qMatrix, vMatrix);
		m.multiply(pMatrix, vMatrix, tmpMatrix);
		
		// テクスチャの設定
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		
		// ステンシルによるフィルタリングを設定する
		gl.enable(gl.STENCIL_TEST);

    // カラーと深度をマスク
    gl.colorMask(false, false, false, false);
    gl.depthMask(false);

		// トーラス（シルエット）用ステンシル設定
		gl.stencilFunc(gl.ALWAYS, 1, ~0);
		gl.stencilOp(gl.KEEP, gl.REPLACE, gl.REPLACE);

    // トーラスの頂点データ
    set_attribute(tVBOList, attLocation, attStride);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tIndex);

    // トーラスモデル座標変換行列の生成
    m.identity(mMatrix);
    m.rotate(mMatrix, rad, [0.0, 1.0, 1.0], mMatrix);
    m.multiply(tmpMatrix, mMatrix, mvpMatrix);

    // uniform変数の登録と描画
    gl.uniformMatrix4fv(uniLocation[0], false, mvpMatrix);
    gl.uniform1i(uniLocation[3], false); // ライティングOFF
    gl.uniform1i(uniLocation[5], false); // テクスチャOFF
    gl.uniform1i(uniLocation[6], true); // アウトラインON
    gl.drawElements(gl.TRIANGLES, torusData.i.length, gl.UNSIGNED_SHORT, 0);
		
        // カラーと深度のマスクを解除
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);

    // 球体モデル用ステンシル設定
    gl.stencilFunc(gl.EQUAL, 0, ~0);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

    // 球体モデルの頂点データ
    set_attribute(sVBOList, attLocation, attStride);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sIndex);

    // 球体モデル座標変換行列の生成
    m.identity(mMatrix);
    m.scale(mMatrix, [50.0, 50.0, 50.0], mMatrix);
    m.multiply(tmpMatrix, mMatrix, mvpMatrix);

    // uniform変数の登録と描画
    gl.uniformMatrix4fv(uniLocation[0], false, mvpMatrix);
    gl.uniform1i(uniLocation[3], false); // *ライティング OFF
    gl.uniform1i(uniLocation[4], 0);
    gl.uniform1i(uniLocation[5], true);  // *テクスチャ   ON
    gl.uniform1i(uniLocation[6], false); // *アウトライン OFF
    gl.drawElements(gl.TRIANGLES, sphereData.i.length, gl.UNSIGNED_SHORT, 0);

    // ステンシルテストを無効にする
    gl.disable(gl.STENCIL_TEST);

    // トーラスの頂点データ
    set_attribute(tVBOList, attLocation, attStride);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tIndex);

    // トーラスモデル座標変換行列の生成
    m.identity(mMatrix);
    m.rotate(mMatrix, rad, [0.0, 1.0, 1.0], mMatrix);
    m.multiply(tmpMatrix, mMatrix, mvpMatrix);

    // uniform変数の登録と描画
    gl.uniformMatrix4fv(uniLocation[0], false, mvpMatrix);
    gl.uniformMatrix4fv(uniLocation[1], false, invMatrix);
    gl.uniform3fv(uniLocation[2], lightDirection);
    gl.uniform1i(uniLocation[3], true);  // *ライティング ON
    gl.uniform1i(uniLocation[5], false); // *テクスチャ   OFF
    gl.uniform1i(uniLocation[6], false); // *アウトライン OFF
    gl.drawElements(gl.TRIANGLES, torusData.i.length, gl.UNSIGNED_SHORT, 0);

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

  function create_texture(source, number) {
    // イメージオブジェクトの生成
    var img = new Image();

    // データのオンロードをトリガーとする
    img.onload = function () {
      var tex = gl.createTexture();

      // テクスチャをバインドする
      gl.bindTexture(gl.TEXTURE_2D, tex);

      // テクスチャへイメージを適用
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

      // ミップマップを生成
      gl.generateMipmap(gl.TEXTURE_2D);

      // テクスチャのバインドを無効化
      gl.bindTexture(gl.TEXTURE_2D, null);

      texture = tex;
    };

    // イメージオブジェクトのソースを指定
    img.src = source;
  };

  function blend_type(prm) {
    switch(prm) {
      //透過処理
      case 0:
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        break;
      //加算合成
      case 1:
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        break;
      default:
        break;
    }
  }
}

