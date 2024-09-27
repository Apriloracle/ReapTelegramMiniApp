import { AnnoyTree } from './components/AnnoyTree';
import { vectorDistSqr } from './utils/VectorUtils';
import * as Types from './types';

export { Types };

export default class Annoy {
    private forest: AnnoyTree[];
    private dimensions: number;
    private maxValues: number;

    constructor(forestSize: number, dimensions: number, maxValues: number) {
        this.forest = [...new Array(forestSize)].map(() => new AnnoyTree(dimensions, maxValues));
        this.dimensions = dimensions;
        this.maxValues = maxValues;
    }

    public get(inputVector: Types.Vector, max: number): Types.DataPoint[] {
        if (!inputVector || inputVector.length !== this.dimensions) {
            console.error('Invalid input vector');
            return [];
        }

        const closestFromAllTrees: Set<Types.DataPoint> = new Set();

        for (let i = 0; i < this.forest.length; i++) {
            const tree: AnnoyTree = this.forest[i];
            const closestInTree: Types.DataPoint[] = tree.get(inputVector);
            closestInTree.forEach((closePoint: Types.DataPoint) => {
                if (closePoint && closePoint.v) {
                    closestFromAllTrees.add(closePoint);
                }
            });
        }

        let result: Types.DataPoint[];

        if (max && closestFromAllTrees.size > max)
            result = Array.from(closestFromAllTrees)
                .filter(point => point && point.v)
                .sort((a: Types.DataPoint, b: Types.DataPoint) => vectorDistSqr(a.v, inputVector) - vectorDistSqr(b.v, inputVector))
                .slice(0, max);
        else result = Array.from(closestFromAllTrees).filter(point => point && point.v);

        return result;
    }

    public add(p: Types.DataPoint) {
        if (!p) {
            console.error('Invalid data point: point is null or undefined');
            return;
        }
        if (!p.v) {
            console.error('Invalid data point: vector is missing', p);
            return;
        }
        if (p.v.length !== this.dimensions) {
            console.error(`Invalid data point: vector length ${p.v.length} does not match expected dimensions ${this.dimensions}`, p);
            return;
        }

        for (let i = 0; i < this.forest.length; i++) {
            const tree: AnnoyTree = this.forest[i];
            tree.addPoint(p);
        }
    }

    // ... rest of the Annoy class implementation ...
}
