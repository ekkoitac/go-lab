// Run with: go run ./tests/fixtures/data-boundary-go/main.go
// Real standard-library checks for the finite browser teaching models.
package main

import (
 "context"
 "database/sql"
 "database/sql/driver"
 "encoding/json"
 "errors"
 "fmt"
 "html/template"
 "io"
 "path/filepath"
 "runtime"
 "strings"
)

var checks int
func check(ok bool, name string) { if !ok { panic(name) }; checks++ }
func main() {
 type Order struct {
  status string `json:"status"`
  Name string `json:"name"`
  Secret string `json:"-"`
  Empty string `json:"empty,omitempty"`
 }
 encoded, err := json.Marshal(Order{status:"paid", Name:"book", Secret:"hidden"})
 check(err == nil && string(encoded) == `{"name":"book"}`, "71 exported fields and tags")
 for _, input := range []string{`{}`, `{"Limit":null}`} {
  var value struct{Limit int}; var pointer struct{Limit *int}; var raw map[string]json.RawMessage
  check(json.Unmarshal([]byte(input), &value)==nil && value.Limit==0,"72 new int")
  check(json.Unmarshal([]byte(input), &pointer)==nil && pointer.Limit==nil,"72 new pointer")
  check(json.Unmarshal([]byte(input), &raw)==nil,"72 raw decode")
  _, present:=raw["Limit"]; check(present==(input!=`{}`),"72 raw existence")
 }
 reused:=struct{Limit int}{100}
 check(json.Unmarshal([]byte(`{"Limit":null}`), &reused)==nil && reused.Limit==100,"72 null leaves existing scalar")
 check(json.Unmarshal([]byte(`{}`), &reused)==nil && reused.Limit==100,"72 missing retains existing scalar")
 check(json.Unmarshal([]byte(`{"Limit":0}`), &reused)==nil && reused.Limit==0,"72 explicit zero")
 var number any
 check(json.Unmarshal([]byte(`9007199254740993`), &number)==nil && fmt.Sprintf("%.0f",number)=="9007199254740992","73 float rounding")
 decoder:=json.NewDecoder(strings.NewReader(`9007199254740993`)); decoder.UseNumber()
 check(decoder.Decode(&number)==nil && number.(json.Number).String()=="9007199254740993","73 Number text")
 exact,e:=number.(json.Number).Int64(); check(e==nil && exact==9007199254740993,"73 Int64 exact")
 _,e=json.Number("9223372036854775808").Int64(); check(e!=nil,"73 Int64 overflow")
 _,e=json.Number("-9223372036854775809").Int64(); check(e!=nil,"73 Int64 negative overflow")
 for _, c:=range []struct{input string; first, tail string}{
  {`{"n":1}`,"ok","eof"}, {"{\"n\":1} \n\t","ok","eof"},
  {`{"n":1} {"n":2}`,"ok","value"}, {`{"n":1} null`,"ok","value"},
  {`{"n":1} broken`,"ok","error"}, {`{"n":1,"unknown":2}`,"error","skip"},
 } {
  d:=json.NewDecoder(strings.NewReader(c.input)); d.DisallowUnknownFields()
  var target struct{N int `json:"n"`}; e:=d.Decode(&target)
  check((e==nil)==(c.first=="ok"),"74 first Decode "+c.input)
  if e!=nil {continue}; var extra any; e=d.Decode(&extra)
  got:="error"; if e==io.EOF {got="eof"} else if e==nil {got="value"}
  check(got==c.tail,"74 second Decode "+c.input)
 }
 sql.Register("boundary-fixture", fixtureDriver{})
 db,e:=sql.Open("boundary-fixture", ""); if e!=nil {panic(e)}; defer db.Close(); db.SetMaxOpenConns(1)
 rows,e:=db.Query("normal"); check(e==nil && db.Stats().InUse==1,"76 acquired rows")
 check(rows.Next(),"76 first row"); var text string; check(rows.Scan(&text)==nil,"76 Scan")
 check(db.Stats().InUse==1,"76 first row retains connection")
 check(rows.Close()==nil && db.Stats().InUse==0,"76 explicit Close releases")
 rows,e=db.Query("normal"); check(e==nil && rows.Next(),"76 EOF fixture")
 check(!rows.Next() && rows.Err()==nil && db.Stats().InUse==0,"76 EOF auto close")
 rows,e=db.Query("error"); check(e==nil && rows.Next(),"76 traversal fixture")
 check(!rows.Next() && rows.Err()!=nil && db.Stats().InUse==0,"76 traversal error and release")
 rows,e=db.Query("normal"); check(e==nil && rows.Next(),"76 Scan error fixture")
 var integer int; check(rows.Scan(&integer)!=nil && rows.Err()==nil && db.Stats().InUse==1,"76 Scan error distinct from Rows.Err")
 rows.Close()
 held,e:=db.Query("normal"); check(e==nil,"78 hold connection")
 ctx,cancel:=context.WithCancel(context.Background()); cancel()
 _,e=db.QueryContext(ctx,"normal"); check(errors.Is(e,context.Canceled) && db.Stats().InUse==1,"78 cancellation does not release another holder")
 held.Close(); stats:=db.Stats(); check(stats.OpenConnections==stats.InUse+stats.Idle && stats.InUse==0,"78 pool stats")
 check(filepath.Clean("../secret.txt")==filepath.FromSlash("../secret.txt") && !filepath.IsLocal("../secret.txt"),"79 Clean is not confinement")
 check(filepath.IsLocal("nested/report.txt"),"79 local path")
 if runtime.GOOS=="windows" {check(!filepath.IsLocal(`C:\secret.txt`) && !filepath.IsLocal(`NUL`),"79 Windows absolute and reserved names")}
 tmpl:=template.Must(template.New("text").Parse("<p>{{.}}</p>")); var out strings.Builder
 check(tmpl.Execute(&out,"<script>x</script>")==nil && out.String()=="<p>&lt;script&gt;x&lt;/script&gt;</p>","80 HTML text context")
 fmt.Printf("PASS %d standard-library semantic checks (%s/%s %s)\n",checks,runtime.GOOS,runtime.GOARCH,runtime.Version())
}

type fixtureDriver struct{}
type fixtureConn struct{}
type fixtureRows struct { done bool; fail bool }
func (fixtureDriver) Open(string)(driver.Conn,error){return fixtureConn{},nil}
func (fixtureConn) Prepare(string)(driver.Stmt,error){return nil,errors.New("unsupported")}
func (fixtureConn) Close()error{return nil}
func (fixtureConn) Begin()(driver.Tx,error){return nil,errors.New("unsupported")}
func (fixtureConn) QueryContext(_ context.Context, query string, _ []driver.NamedValue)(driver.Rows,error){return &fixtureRows{fail:query=="error"},nil}
func (*fixtureRows) Columns()[]string{return []string{"value"}}
func (*fixtureRows) Close()error{return nil}
func (r *fixtureRows) Next(dest []driver.Value)error{if r.done {if r.fail{return errors.New("stream failed")};return io.EOF};r.done=true;dest[0]="text";return nil}
