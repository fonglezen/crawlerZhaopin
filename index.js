/**
 *  抓取智联招聘nodejs相关岗位的信息
 *  获取方式： http://sou.zhaopin.com/jobs/searchresult.ashx?jl=%E6%B7%B1%E5%9C%B3&kw=node&p=1
 *  容器 #newlist_list_content_table .newlist
 *  position .zwmc a
 *  company: .gsmc a[0]
 *  salary: .zwyx 
 *  area: .gzdd
 */

const http = require('http');
const cheerio = require('cheerio')
const fs = require('fs')
const createCSVFile = require('csv-file-creator');

let totalpage = 1;
let positionData = [];
let offset = 1; 

// 最大并发请求数 = 5
const max_concurrency = 5;

function handleHtml(html) {
    const $ = cheerio.load(html);
    
    const wrap = $('#newlist_list_content_table');
    const list = wrap.find('.newlist');

    list.each(function(i, elem) {
        if(i != 0){
            let position = {
                name: $(this).find('.zwmc').find('a').text(),
                company: $(this).find('.gsmc').find('a').text(),
                salary: $(this).find('.zwyx').text(),
                area: $(this).find('.gzdd').text()
            };
    
            positionData.push(position);
        }

        
        
    });    

}

function saveToCsv (){
    let cvsdata = [
        ['职位名称','公司名称','月薪','地区']
    ];
    positionData.map((item) => {
        cvsdata.push([
            item.name,
            item.company,
            item.salary,
            item.area
        ]);
    })
    try {
        createCSVFile('./result/data.csv', cvsdata);
        console.log('The cvs file has been saved!')
    } catch (error) {
        console.log('Save cvs file failed! ', error)
    }
    
} 

function saveToJson() {
    fs.writeFile('./result/data.json', JSON.stringify(positionData), (err) => {
        if (err) throw err;
        console.log('The json file has been saved!');
    });
}

// 传入要获取的页面的页码
function getData(nowpage) {
    console.log(`=== download page ${nowpage} ===`)

    let options = {
        hostname: 'sou.zhaopin.com',
        port: 80,
        path: `/jobs/searchresult.ashx?jl=%E6%B7%B1%E5%9C%B3&kw=node&p=${nowpage}`,
        method: 'get',
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        }
    };
    return new Promise((resolve, reject) => {
        http.get(options, (res) => {
            const { statusCode } = res;
            const contentType = res.headers['content-type'];
        
            let error;
            if (statusCode !== 200) {
                error = new Error('Request Failed.\n' +
                                `Status Code: ${statusCode}`);
            }
        
            if (error) {
                
                console.error(error.message);
                // consume response data to free up memory
                res.resume();

                reject(error);
            }
        
            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                resolve(rawData)
            });
        }).on('error', (e) => {
            reject(`Got error: ${e.message}`)
        });
    
    })
}

// loop
function getDataLoop() {
    // if offset lt totalpage, go on 
    if(offset < totalpage){
        let end = offset + max_concurrency;
        let start = offset;

        if(end > totalpage) {
            end = totalpage;
        }

        offset = end;

        var promises = [];

        while (start < end) {
            start += 1;
            promises.push(getData(start));
        }

        Promise.all(promises).then(values => {
            values.map((item) => {
                handleHtml(item);
            });

            if(offset < totalpage){
                getDataLoop();
            }else {
                console.log('.... End ....');
                saveToJson();
                saveToCsv();
            }
        });
        
    }
}

// 开始获取数据
console.log('.... Start ....')

// 首先获取首页，并得到总页数
getData(offset)
    .then( (data) => {
        handleHtml(data);

        // 获取总页码
        const $ = cheerio.load(data);
        const li = $('.pagesDown').find('li');
        const li_len = li.length;
        const last_page = li.eq(li_len - 4);

        totalpage = parseInt(last_page.text());
        

        // 开始后面的并发请求
        getDataLoop();
    });
