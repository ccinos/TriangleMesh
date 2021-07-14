class TriangleMesh{

    constructor(){
        this.Vertices=[];
        this.Edges=[];
        this.BoundaryVertices=[]; //int
        this.BoundaryEdges=[];
        this.Triangles=[];
        this.m_initVertices=[];

    }

    static Triangulate2(vertices){
        var triangleMesh = new TriangleMesh();
        for(var i=0;i<vertices.length;++i){
            triangleMesh.Vertices[i]=new Vector3(vertices[i].x,0,vertices[i].y);// vertices[i];
        }
        triangleMesh.triangulate();
        return triangleMesh;
    }

    static Triangulate3(vertices){
        var triangleMesh = new TriangleMesh();
        for(var i=0;i<vertices.length;++i){
            triangleMesh.Vertices[i]=new Vector3(vertices[i].x,vertices[i].y,vertices[i].z);// vertices[i];
        }
        triangleMesh.triangulate();
        return triangleMesh;
    }

    static AlmostEqual(x, y) {
        return Math.abs(x - y) <= 1.401298E-38 * Math.abs(x + y) * 2;
    }
    static AlmostEqualVector3(left, right) {
        return TriangleMesh.AlmostEqual(left.x, right.x) && TriangleMesh.AlmostEqual(left.z, right.z);
    }
    computeTriangleDirection(list) {
        var count = 0;
        if (list.length >= 3) {
          var r;
          var AB, BC;
          for (var i = 0; i < list.length - 2; ++i) {
            AB = this.getVertex(list[i + 1]).sub(this.getVertex(list[0])).toVector2(); //始终使用第一个点进行计算
            BC = this.getVertex(list[i + 2]).sub(this.getVertex(list[i + 1])).toVector2();
            r = AB.x * BC.y - AB.y * BC.x;
            if (r > 0) ++count;
            else if (r < 0) --count;
          }
        }
        return count;
    }
    static removeOrSet(list, t) {
        var di=list.findIndex(e=>e==t);
        if(di==-1){
            list.push(t);
        }else{
            list.splice(di,1);
        }
    }
    static listRemove(list, t){
        var di=list.findIndex(e=>e==t);
        if(di!=-1){
            list.splice(di,1);
        }
    }

    getVertex(i){
        if (i < 0) {
            if (i >= -3)
                return this.m_initVertices[-i - 1];
        } else {
            return this.Vertices[i];
        }
    }

    static removeAll(array,callback){
        for(var i=array.length-1;i>=0;--i){
            if(callback(array[i],i)){
                array.splice(i,1);
            }
        }
    }

    triangulate() {
        /* 基于Bowyer-Watson算法原理
         * 通过所有顶点和现有三角形进行判断, 对包含该点的三角形进行拆分
         * 首先构建初始的三角形,包含全部点在内(最后会删除)
         * 
         * 遍历所有顶点 {
         *    遍历所有现有三角形 {
         *        首先判断是否 [顶点] 在 [三角形] 内, 如果不在则跳过
         *        [顶点] 和 [三角形] 的3条边,生成新的3个三角形,加入现有三角形集合中
         *    }
         * }
         */
        // 构建初始三角形,可以包含住所有的点
        var minX = this.Vertices[0].x;
        var minZ = this.Vertices[0].z;
        var maxX = minX;
        var maxZ = minZ;
        
        this.Vertices.forEach(vertex=>{
            if (vertex.x < minX) minX = vertex.x;
            if (vertex.x > maxX) maxX = vertex.x;
            if (vertex.z < minZ) minZ = vertex.z;
            if (vertex.z > maxZ) maxZ = vertex.z;
        });
    
        var dx = maxX - minX;
        var dz = maxZ - minZ;
        var deltaMax = Math.max(dx, dz) * 2;
        this.m_initVertices[0] = new Vector3(minX - 1, 0, minZ - 1);
        this.m_initVertices[1] = new Vector3(minX - 1, 0, maxZ + deltaMax);
        this.m_initVertices[2] = new Vector3(maxX + deltaMax, 0, minZ - 1);
    
        this.Triangles.push(new Triangle(this, -1, -2, -3));
    
        // 通过顶点对三角形进行拆分
        var vertexInfos = {}; //<int, VertexInfo>
    
        //遍历所有顶点
        for (var vi = 0,vlen= this.Vertices.length; vi < vlen; ++vi) {
          vertexInfos[vi] = new VertexInfo(vi); 
    
          var polygon = []; //new List<Edge>();
          //遍历所有现有三角形
          this.Triangles.forEach(t=>{
            if (t.CircumCircleContains(vi)) {//如果包含该点
                //标记删除
                t.IsBad = true;
                //记录下三条边
                polygon.push(new Edge(this, t.A, t.B));
                polygon.push(new Edge(this, t.B, t.C));
                polygon.push(new Edge(this, t.C, t.A));
              }
          });
          //删除标记的三角形
          TriangleMesh.removeAll(this.Triangles,t=>t.IsBad)
          //删除近似的边
          for (var i = 0; i < polygon.length; i++) {
            for (var j = i + 1; j < polygon.length; j++) {
              if (polygon[i].almostEqual(polygon[j])) {
                polygon[i].IsBad = true;
                polygon[j].IsBad = true;
              }
            }
          }
          TriangleMesh.removeAll(polygon, e => e.IsBad);
          //通过点和边构建新的三角形,加入到现有三角形集合中
          polygon.forEach(edge=>{
            this.Triangles.push(new Triangle(this, edge.U, edge.V, vi));
          });
        }
        //删除所有包含初始点的三角形
        TriangleMesh.removeAll(this.Triangles, t=> t.ContainsVertex(-1) || t.ContainsVertex(-2) || t.ContainsVertex(-3));

        //寻找边界
        var edgeSet={};
        var addToEdgeSet=function(edgeSet,edge){
            var key=edge.U>edge.V?edge.V+"_"+edge.U:edge.U+"_"+edge.V;
            if(edgeSet[key]) return false;
            edgeSet[key]=true;
            return true;
        }
        //提取边信息
        this.Triangles.forEach(t=>{
            var ab = new Edge(this, t.A, t.B);
            var bc = new Edge(this, t.B, t.C);
            var ca = new Edge(this, t.C, t.A);
      
            if(addToEdgeSet(edgeSet,ab)){
                this.Edges.push(ab);
            }
            if(addToEdgeSet(edgeSet,bc)){
                this.Edges.push(bc);
            }
            if(addToEdgeSet(edgeSet,ca)){
                this.Edges.push(ca);
            }
      
            //为各点添加邻接三角形信息
            vertexInfos[t.A].triangles.push(t);
            vertexInfos[t.B].triangles.push(t);
            vertexInfos[t.C].triangles.push(t);
        });
    
        //提取边界信息
        var needRemoveVertices = [];// new List<int>();

        var vertexInfosValues=Object.values(vertexInfos);
        vertexInfosValues.forEach(info=>{
            info.triangles.forEach(t=>{
                TriangleMesh.removeOrSet(info.neighboVertices, t.A);
                TriangleMesh.removeOrSet(info.neighboVertices, t.B);
                TriangleMesh.removeOrSet(info.neighboVertices, t.C);
            });
            TriangleMesh.removeAll(info.neighboVertices, e=>e==info.vertex);
        
            if (info.neighboVertices.length == 0) {
                needRemoveVertices.push(info.vertex);
            }
        });
        needRemoveVertices.forEach(v=>{
            delete(vertexInfos[v]);
        });
    
        //遍历边界点信息，构成一条曲线点集合
        var vertexInfo=vertexInfosValues.findIndex(vi=>vi.neighboVertices.length > 0);
        if(vertexInfo!=-1){
            vertexInfo=vertexInfosValues[vertexInfo];
            //添加第一个点
            this.BoundaryVertices.push(vertexInfo.vertex);
            var v,currentV;
            while (vertexInfo.neighboVertices.length > 0) {
                //获得下一个点
                v = vertexInfo.neighboVertices[vertexInfo.neighboVertices.length - 1];
                currentV = vertexInfo.vertex;
        
                if (v == this.BoundaryVertices[0]) {//下一个点与第一个点相同,则跳出循环(闭合)
                    break;
                }
                //在当前点信息中删除点
                TriangleMesh.listRemove(vertexInfo.neighboVertices,v);
                //该点添加到边界点集合中
                this.BoundaryVertices.push(v);
        
                //点信息更换为该点
                vertexInfo = vertexInfos[v];
                //该点的信息中,删除上次点
                TriangleMesh.listRemove(vertexInfo.neighboVertices, currentV);
            }
        }

        //超过3个点，在这里判断点的方向
        if (this.BoundaryVertices.length >= 3) {
          if (this.computeTriangleDirection(this.BoundaryVertices) < 0) { //逆时针
            this.BoundaryVertices.reverse();
          }
        }
    
        //边界点构成线
        for (var i = 0, len = this.BoundaryVertices.length; i < len; ++i) {
          var vertex = this.BoundaryVertices[i];
          var j = i == len - 1 ? 0 : i + 1;
          // i -> j
          this.BoundaryEdges.push(new Edge(this, this.BoundaryVertices[i], this.BoundaryVertices[j]));
        }
    
        vertexInfos={};
    }
    

}
//三角形
class Triangle {
    constructor(ctx,a,b,c){
        this.A=a;this.B=b;this.C=c;
        this.IsBad=false;
        this.ctx=ctx;
    }

    /// 三角形顶点是否包含点v
    ContainsVertex(v) {
      return v == this.A || v == this.B || v == this.C;
    }

    /// 计算外接圆是否包含点v
    CircumCircleContains(V) {
      var a = this.ctx.getVertex(this.A).toVector2();
      var b = this.ctx.getVertex(this.B).toVector2();
      var c = this.ctx.getVertex(this.C).toVector2();
      var v = this.ctx.getVertex(V).toVector2();

      var ab = a.sqrMagnitude();
      var cd = b.sqrMagnitude();
      var ef = c.sqrMagnitude();

      var circumX = (ab * (c.y - b.y) + cd * (a.y - c.y) + ef * (b.y - a.y)) / (a.x * (c.y - b.y) + b.x * (a.y - c.y) + c.x * (b.y - a.y));
      var circumY = (ab * (c.x - b.x) + cd * (a.x - c.x) + ef * (b.x - a.x)) / (a.y * (c.x - b.x) + b.y * (a.x - c.x) + c.y * (b.x - a.x));

      var circum = new Vector2(circumX / 2, circumY / 2);
      var circumRadius = a.sub(circum).sqrMagnitude();
      var dist = v.sub(circum).sqrMagnitude();
      return dist <= circumRadius;
    }

    equals(other){
        return (this.A == other.A || this.A == other.B || this.A == other.C)
            && (this.B == other.A || this.B == other.B || this.B == other.C)
            && (this.C == other.A || this.C == other.B || this.C == other.C);
    }
}

// 边
class Edge {
    constructor(ctx,u,v){
        this.U=u;this.V=v;this.ctx=ctx;
        this.IsBad=false;
    }
    equals(other){
        return (this.U == other.U && this.V == other.V) 
            || (this.U == other.V && this.V == other.U);
    }

    almostEqual(other) {
        var ctx=this.ctx;
        return TriangleMesh.AlmostEqualVector3(ctx.getVertex(this.U), ctx.getVertex(other.U)) 
            && TriangleMesh.AlmostEqualVector3(ctx.getVertex(this.V), ctx.getVertex(other.V))
            || TriangleMesh.AlmostEqualVector3(ctx.getVertex(this.U), ctx.getVertex(other.V)) 
            && TriangleMesh.AlmostEqualVector3(ctx.getVertex(this.V), ctx.getVertex(other.U));
    }
}


class Vector2{
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    static zero=new Vector2(0,0)
    sqrMagnitude(){ return this.x * this.x + this.y * this.y; }
    add(other){
        return new Vector2(this.x+other.x,this.y+other.y)
    }
    sub(other){
        return new Vector2(this.x-other.x,this.y-other.y)
    }
}


class Vector3{
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    static zero=new Vector3(0,0,0)
    toVector2(){
        return new Vector2(this.x,this.z);
    }
    add(other){
        return new Vector3(this.x+other.x,this.y+other.y,this.z+other.z)
    }
    sub(other){
        return new Vector3(this.x-other.x,this.y-other.y,this.z-other.z)
    }
}

class VertexInfo {
    constructor(vertex){
        this.neighboVertices=[];
        this.triangles=[];
        this.vertex=vertex;
    }
}